package com.yaoyuquan.jungle.llm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 把发给模型的请求与模型的原始响应打到日志。
 * <p>
 * 单独拎出来是因为两个客户端都要用，而且排查问题时最需要的就是「到底发了什么、回了什么」。
 * 密钥只存在于请求头里，这里只打请求体与响应体，不会带出密钥。
 *
 * @author yaoyuquan
 */
public final class LlmPayloadLogger {

    private static final Logger log = LoggerFactory.getLogger(LlmPayloadLogger.class);

    /** 单条日志最多打这么多字符，避免超长提示词把日志刷爆 */
    private static final int MAX_CHARS = 8000;

    private final boolean enabled;
    private final String providerName;

    public LlmPayloadLogger(boolean enabled, String providerName) {
        this.enabled = enabled;
        this.providerName = providerName;
    }

    /**
     * 打印请求。
     *
     * @param endpoint 实际请求的地址
     * @param payload  请求体
     */
    public void logRequest(String endpoint, String payload) {
        if (!enabled) {
            return;
        }
        log.info("[{}] → 请求 {}\n{}", providerName, endpoint, truncate(payload));
    }

    /**
     * 打印响应。
     *
     * @param status  HTTP 状态码，SDK 路径拿不到时传 -1
     * @param payload 响应体
     */
    public void logResponse(int status, String payload) {
        if (!enabled) {
            return;
        }
        if (status < 0) {
            log.info("[{}] ← 响应\n{}", providerName, truncate(payload));
        } else {
            log.info("[{}] ← 响应 HTTP {}\n{}", providerName, status, truncate(payload));
        }
    }

    /**
     * 打印调用失败。失败时无论开关如何都要留痕，否则排查无从下手。
     */
    public void logFailure(String message, Throwable cause) {
        log.warn("[{}] ✗ 调用失败：{}", providerName, message, cause);
    }

    /**
     * 截断过长的内容，并标出原始长度。
     */
    private static String truncate(String text) {
        if (text == null) {
            return "<null>";
        }
        if (text.length() <= MAX_CHARS) {
            return text;
        }
        return text.substring(0, MAX_CHARS) + "…（共 " + text.length() + " 字符，已截断）";
    }
}
