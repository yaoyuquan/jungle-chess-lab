package com.yaoyuquan.jungle.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.yaoyuquan.jungle.config.AiPlayer;
import com.yaoyuquan.jungle.config.ProviderConfig;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

/**
 * OpenAI 兼容客户端的请求体构造测试。
 * <p>
 * 重点是 response_format：各家支持程度不同，有的只认 json_object，
 * 发错了会被接口直接拒掉，所以这里逐档断言。
 *
 * @author yaoyuquan
 */
class OpenAiCompatibleLlmClientTest {

    private static final AiPlayer PLAYER = new AiPlayer(
            "shentong", "深瞳", "SHENTONG",
            "gpt", "gpt-4o", "medium", 0.7);

    /**
     * 造一个指定 json-mode 的客户端。带 key 才会真正建出 RestClient，但这里只调 buildBody 不发请求。
     */
    private static OpenAiCompatibleLlmClient client(String jsonMode) {
        ProviderConfig config = new ProviderConfig(
                "openai", "https://example.test/v1", "test-key", jsonMode, null);
        return new OpenAiCompatibleLlmClient(config, Duration.ofSeconds(5), new ObjectMapper(),
                new LlmPayloadLogger(false, "test"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> responseFormat(Map<String, Object> body) {
        return (Map<String, Object>) body.get("response_format");
    }

    @Test
    @DisplayName("json_schema 模式带完整 schema 与 strict")
    void buildsJsonSchemaFormat() {
        Map<String, Object> body = client("json_schema").buildBody(PLAYER, "sys", "user");
        Map<String, Object> format = responseFormat(body);

        assertThat(format).containsEntry("type", "json_schema");
        @SuppressWarnings("unchecked")
        Map<String, Object> schema = (Map<String, Object>) format.get("json_schema");
        assertThat(schema).containsEntry("name", MoveChoiceSchema.NAME);
        assertThat(schema).containsEntry("strict", true);
        assertThat(schema).containsKey("schema");
    }

    @Test
    @DisplayName("json_object 模式只带 type，不带 schema —— 只支持到这一档的接口要的就是这个形状")
    void buildsJsonObjectFormat() {
        Map<String, Object> format = responseFormat(client("json_object").buildBody(PLAYER, "sys", "user"));

        assertThat(format).containsExactly(Map.entry("type", "json_object"));
    }

    @Test
    @DisplayName("none 模式完全不带 response_format")
    void omitsFormatEntirely() {
        Map<String, Object> body = client("none").buildBody(PLAYER, "sys", "user");

        assertThat(body).doesNotContainKey("response_format");
        assertThat(body).containsKeys("model", "temperature", "messages");
    }

    @Test
    @DisplayName("没配 json-mode 时默认用 json_schema")
    void defaultsToJsonSchema() {
        assertThat(responseFormat(client(null).buildBody(PLAYER, "sys", "user")))
                .containsEntry("type", "json_schema");
    }

    @Test
    @DisplayName("json-mode 写法容忍大小写与连字符，非法值退回 json_schema")
    void parsesJsonModeLeniently() {
        assertThat(responseFormat(client("JSON-OBJECT").buildBody(PLAYER, "sys", "user")))
                .containsEntry("type", "json_object");
        assertThat(responseFormat(client("  Json_Object  ").buildBody(PLAYER, "sys", "user")))
                .containsEntry("type", "json_object");
        assertThat(client("text").buildBody(PLAYER, "sys", "user")).doesNotContainKey("response_format");
        assertThat(responseFormat(client("乱写的值").buildBody(PLAYER, "sys", "user")))
                .containsEntry("type", "json_schema");
    }

    @Test
    @DisplayName("model 与 temperature 取自棋手配置，temperature 缺省为 1.0")
    void carriesPlayerSettings() {
        Map<String, Object> body = client("json_object").buildBody(PLAYER, "sys", "user");
        assertThat(body).containsEntry("model", "gpt-4o");
        assertThat(body).containsEntry("temperature", 0.7);

        AiPlayer noTemp = new AiPlayer("x", "X", "X", "gpt", "gpt-4o", null, null);
        assertThat(client("json_object").buildBody(noTemp, "sys", "user")).containsEntry("temperature", 1.0);
    }
}
