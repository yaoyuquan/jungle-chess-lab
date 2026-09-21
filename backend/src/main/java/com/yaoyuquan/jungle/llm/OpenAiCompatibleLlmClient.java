package com.yaoyuquan.jungle.llm;

import com.yaoyuquan.jungle.config.AiPlayer;
import com.yaoyuquan.jungle.config.ProviderConfig;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 通过 OpenAI 兼容接口（/v1/chat/completions）调用模型选着法。
 * <p>
 * 这条路径的 wire 格式与 Anthropic 不同，不能复用官方 SDK，所以直接发 JSON。
 * <p>
 * 各家对 response_format 的支持程度不一样：OpenAI 官方支持完整的 json_schema，
 * 有的只支持 json_object，还有些中转什么都不支持。
 * 因此约束方式由连接配置的 json-mode 决定，不再写死。
 * <p>
 * 一个实例对应一条具名连接，由 {@link LlmClientRegistry} 按需创建。
 *
 * @author yaoyuquan
 */
public class OpenAiCompatibleLlmClient implements LlmClient {

    private static final String DEFAULT_BASE_URL = "https://api.openai.com/v1";
    private static final String PATH = "/chat/completions";

    private final ObjectMapper objectMapper;
    private final ProviderConfig.JsonMode jsonMode;
    private final LlmPayloadLogger payloadLogger;
    private final JsonHttpClient http;

    public OpenAiCompatibleLlmClient(ProviderConfig config, Duration timeout,
                                     ObjectMapper objectMapper, LlmPayloadLogger payloadLogger) {
        this.objectMapper = objectMapper;
        this.payloadLogger = payloadLogger;
        this.jsonMode = config == null ? ProviderConfig.JsonMode.JSON_SCHEMA : config.resolvedJsonMode();
        this.http = new JsonHttpClient(config, DEFAULT_BASE_URL, timeout);
    }

    @Override
    public boolean isAvailable() {
        return http.isAvailable();
    }

    @Override
    public MoveChoice choose(MoveQuery query) {
        String requestJson;
        try {
            requestJson = objectMapper.writeValueAsString(
                    buildBody(query.player(), query.chat().system(), query.chat().user()));
        } catch (Exception e) {
            throw new LlmCallException("请求体序列化失败：" + e.getMessage(), e);
        }
        payloadLogger.logRequest(http.endpoint(PATH), requestJson);

        JsonHttpResponse response;
        try {
            response = http.post(PATH, requestJson);
        } catch (LlmCallException e) {
            payloadLogger.logFailure(e.getMessage(), e);
            throw new LlmCallException("调用 OpenAI 兼容接口失败：" + e.getMessage(), e);
        }
        payloadLogger.logResponse(response.status(), response.body());

        if (response.isError()) {
            throw new LlmCallException(
                    "OpenAI 兼容接口返回 HTTP " + response.status() + "：" + brief(response.body()));
        }
        return parse(response.body());
    }

    /**
     * 拼请求体。response_format 部分按连接配置的 json-mode 决定，NONE 时整个字段都不带。
     */
    Map<String, Object> buildBody(AiPlayer player, String systemPrompt, String userPrompt) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", player.model());
        body.put("temperature", player.temperature() == null ? 1.0 : player.temperature());
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)));

        switch (jsonMode) {
            case JSON_SCHEMA -> body.put("response_format", Map.of(
                    "type", "json_schema",
                    "json_schema", Map.of(
                            "name", MoveChoiceSchema.NAME,
                            "strict", true,
                            "schema", MoveChoiceSchema.asMap())));
            case JSON_OBJECT -> body.put("response_format", Map.of("type", "json_object"));
            case NONE -> {
                // 什么都不传，完全靠提示词里的输出约定
            }
        }
        return body;
    }

    /**
     * 从 chat/completions 响应里取出第一条消息内容并解析。
     */
    private MoveChoice parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new LlmCallException("OpenAI 兼容接口返回内容为空");
        }
        JsonNode content;
        try {
            content = objectMapper.readTree(raw).path("choices").path(0).path("message").path("content");
        } catch (Exception e) {
            throw new LlmCallException("OpenAI 兼容接口响应无法解析：" + brief(raw), e);
        }
        if (content.isMissingNode() || content.isNull()) {
            throw new LlmCallException("OpenAI 兼容接口响应缺少 message.content：" + brief(raw));
        }
        return JsonMoveChoiceParser.parse(objectMapper, content.asString());
    }

    /**
     * 异常消息里只带一小段响应，完整内容看日志。
     */
    private static String brief(String raw) {
        if (raw == null) {
            return "<null>";
        }
        String text = raw.strip();
        return text.length() <= 300 ? text : text.substring(0, 300) + "…";
    }
}
