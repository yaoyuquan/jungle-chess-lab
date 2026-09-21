package com.yaoyuquan.jungle.llm;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.ObjectMappers;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.models.messages.CacheControlEphemeral;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.TextBlockParam;
import com.yaoyuquan.jungle.config.AiPlayer;
import com.yaoyuquan.jungle.config.ProviderConfig;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import tools.jackson.databind.ObjectMapper;

/**
 * 通过 Anthropic 官方 Java SDK 调用 Claude 选着法。
 * <p>
 * 用结构化输出约束模型只返回 {index, reason}；系统提示词带上缓存标记，
 * 因为同一位棋手每一手的系统提示词完全相同，缓存命中率很高。
 * <p>
 * 一个实例对应一条具名连接，由 {@link LlmClientRegistry} 按需创建。
 *
 * @author yaoyuquan
 */
public class AnthropicLlmClient implements LlmClient {

    private static final long MAX_TOKENS = 4096L;

    private final ObjectMapper objectMapper;
    private final LlmPayloadLogger payloadLogger;
    private final AnthropicClient client;

    public AnthropicLlmClient(ProviderConfig config, Duration timeout, int maxRetries,
                              ObjectMapper objectMapper, LlmPayloadLogger payloadLogger) {
        this.objectMapper = objectMapper;
        this.payloadLogger = payloadLogger;
        this.client = buildClient(config, timeout, maxRetries);
    }

    /**
     * 构建 SDK 客户端。没有配置密钥时返回 null，isAvailable() 会据此让调用方走兜底。
     */
    private static AnthropicClient buildClient(ProviderConfig config, Duration timeout, int maxRetries) {
        if (config == null || !config.hasApiKey()) {
            return null;
        }
        AnthropicOkHttpClient.Builder builder = AnthropicOkHttpClient.builder()
                .apiKey(config.apiKey())
                .timeout(timeout)
                .maxRetries(maxRetries);
        if (config.hasBaseUrl()) {
            builder.baseUrl(config.baseUrl());
        }
        return builder.build();
    }

    @Override
    public boolean isAvailable() {
        return client != null;
    }

    @Override
    public MoveChoice choose(MoveQuery query) {
        if (client == null) {
            throw new LlmCallException("未配置 Anthropic API Key");
        }
        AiPlayer player = query.player();
        String systemPrompt = query.chat().system();
        String userPrompt = query.chat().user();
        MessageCreateParams params = MessageCreateParams.builder()
                .model(player.model())
                .maxTokens(MAX_TOKENS)
                .outputConfig(OutputConfig.builder()
                        .effort(effortOf(player))
                        .format(MoveChoiceSchema.asAnthropicFormat())
                        .build())
                .systemOfTextBlockParams(List.of(
                        TextBlockParam.builder()
                                .text(systemPrompt)
                                .cacheControl(CacheControlEphemeral.builder().build())
                                .build()))
                .addUserMessage(userPrompt)
                .build();

        // SDK 内部封装了 HTTP，这里用它自带的 mapper 把请求体序列化成与实际报文一致的 JSON
        payloadLogger.logRequest("messages.create", toJson(params._body()));

        Message message;
        try {
            message = client.messages().create(params);
        } catch (AnthropicServiceException e) {
            payloadLogger.logFailure("接口返回错误：" + e.getMessage(), e);
            throw new LlmCallException("Anthropic 接口返回错误：" + e.getMessage(), e);
        } catch (RuntimeException e) {
            payloadLogger.logFailure("请求未能完成：" + e.getMessage(), e);
            throw new LlmCallException("调用 Anthropic 失败：" + e.getMessage(), e);
        }
        return parse(message);
    }

    /**
     * 用 SDK 自带的 Jackson mapper 序列化，得到与实际报文一致的 JSON。
     * <p>
     * SDK 走 Jackson 2，本项目注入的 ObjectMapper 是 Jackson 3，注解体系不通用，所以这里不能复用它。
     * 打日志出问题不该影响对局，序列化失败时退回对象自身的 toString。
     */
    private static String toJson(Object value) {
        try {
            return ObjectMappers.jsonMapper().writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    /**
     * 从响应里取出文本块并解析成着法选择。
     */
    private MoveChoice parse(Message message) {
        String text = message.content().stream()
                .map(ContentBlock::text)
                .filter(Optional::isPresent)
                .map(block -> block.get().text())
                .reduce("", String::concat);
        payloadLogger.logResponse(-1, toJson(message));
        if (text.isBlank()) {
            throw new LlmCallException("Anthropic 返回内容为空，stopReason=" + message.stopReason());
        }
        return JsonMoveChoiceParser.parse(objectMapper, text);
    }

    /**
     * 棋手配置的 effort 字符串转 SDK 枚举，非法值退回 MEDIUM。
     */
    private OutputConfig.Effort effortOf(AiPlayer player) {
        String effort = player.effort();
        if (effort == null) {
            return OutputConfig.Effort.MEDIUM;
        }
        return switch (effort.toLowerCase(Locale.ROOT)) {
            case "low" -> OutputConfig.Effort.LOW;
            case "high" -> OutputConfig.Effort.HIGH;
            case "xhigh" -> OutputConfig.Effort.XHIGH;
            case "max" -> OutputConfig.Effort.MAX;
            default -> OutputConfig.Effort.MEDIUM;
        };
    }
}
