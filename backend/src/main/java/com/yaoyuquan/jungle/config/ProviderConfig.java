package com.yaoyuquan.jungle.config;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import org.springframework.util.StringUtils;

/**
 * 一个具名的大模型服务连接配置。
 * <p>
 * 多个棋手可以引用同一个连接，也可以各自引用不同的连接，
 * 于是「Claude 对 GPT」或者「同一模型走两条不同中转」都能配出来。
 *
 * @param type     接口格式，anthropic、openai 或 jev。同一个自定义地址换个格式即可对接另一套协议，留空按 anthropic 处理
 * @param baseUrl  服务地址，留空表示使用该类型的默认地址
 * @param apiKey   访问密钥，留空时该连接下的棋手会直接走启发式兜底
 * @param jsonMode 结构化输出方式，见 {@link JsonMode}。仅对 openai 类型生效，留空按 json_schema 处理；jev 用不到
 * @param timeout  单次调用超时，留空则用 jungle.ai.timeout。推理型模型一步棋可能想十几分钟，需要单独放宽
 * @author yaoyuquan
 */
public record ProviderConfig(String type, String baseUrl, String apiKey, String jsonMode, Duration timeout) {

    public static final String TYPE_ANTHROPIC = "anthropic";
    public static final String TYPE_OPENAI = "openai";
    public static final String TYPE_JEV = "jev";

    /** 支持的全部服务类型，用于在启动时挡住拼错的 type */
    public static final List<String> SUPPORTED_TYPES = List.of(TYPE_ANTHROPIC, TYPE_OPENAI, TYPE_JEV);

    /**
     * OpenAI 兼容接口约束返回结构的方式。各家支持程度不同，所以做成每条连接可配。
     *
     * @author yaoyuquan
     */
    public enum JsonMode {

        /** 完整的 JSON Schema 约束，OpenAI 官方接口支持 */
        JSON_SCHEMA,

        /** 只保证返回是合法 JSON，不校验字段。部分服务商只支持到这一档 */
        JSON_OBJECT,

        /** 完全不传 response_format，纯靠提示词约束 */
        NONE;

        /**
         * 解析配置里的字符串，大小写与连字符都容忍，非法值退回 JSON_SCHEMA。
         */
        static JsonMode parse(String raw) {
            if (!StringUtils.hasText(raw)) {
                return JSON_SCHEMA;
            }
            return switch (raw.trim().toLowerCase(Locale.ROOT).replace('-', '_')) {
                case "json_object" -> JSON_OBJECT;
                case "none", "off", "text" -> NONE;
                default -> JSON_SCHEMA;
            };
        }
    }

    /**
     * 规范化后的服务类型，未配置时按 anthropic 处理。
     */
    public String normalizedType() {
        if (!StringUtils.hasText(type)) {
            return TYPE_ANTHROPIC;
        }
        return type.toLowerCase(Locale.ROOT);
    }

    /**
     * 是否是 Anthropic 接口。
     */
    public boolean isAnthropic() {
        return TYPE_ANTHROPIC.equals(normalizedType());
    }

    /**
     * 是否是 OpenAI 兼容接口。
     */
    public boolean isOpenAi() {
        return TYPE_OPENAI.equals(normalizedType());
    }

    /**
     * 是否是 TypeSafe 的 Jev 判断型模型。
     */
    public boolean isJev() {
        return TYPE_JEV.equals(normalizedType());
    }

    /**
     * type 是否是能认的值。留空算认得（按 anthropic 处理），拼错则不认。
     */
    public boolean isSupportedType() {
        return SUPPORTED_TYPES.contains(normalizedType());
    }

    /**
     * 该连接使用的结构化输出方式。
     */
    public JsonMode resolvedJsonMode() {
        return JsonMode.parse(jsonMode);
    }

    /**
     * 该连接的超时，没配就用传入的全局值。
     */
    public Duration timeoutOr(Duration fallback) {
        return timeout == null ? fallback : timeout;
    }

    /**
     * 是否配置了可用的密钥。
     */
    public boolean hasApiKey() {
        return StringUtils.hasText(apiKey);
    }

    /**
     * 是否配置了自定义服务地址。
     */
    public boolean hasBaseUrl() {
        return StringUtils.hasText(baseUrl);
    }
}
