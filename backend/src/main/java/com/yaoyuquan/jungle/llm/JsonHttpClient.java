package com.yaoyuquan.jungle.llm;

import com.yaoyuquan.jungle.config.ProviderConfig;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * 发 JSON、收原始文本的小客户端，供 OpenAI 兼容与 Jev 两条路径共用。
 * <p>
 * 两个约定很关键：
 * 一是响应按原始字节读回，不交给消息转换器，保证任何状态码下都能拿到报文并打进日志；
 * 二是不用 JdkClientHttpRequestFactory —— 它配上 read timeout 后读响应体走异步订阅，
 * 订阅被取消时抛 "subscription cancelled / closed"，会把超时伪装成解析失败。
 *
 * @author yaoyuquan
 */
public class JsonHttpClient {

    private final RestClient restClient;
    private final String baseUrl;

    public JsonHttpClient(ProviderConfig config, String defaultBaseUrl, Duration timeout) {
        this.baseUrl = config != null && config.hasBaseUrl() ? config.baseUrl() : defaultBaseUrl;
        this.restClient = build(config, this.baseUrl, timeout);
    }

    private static RestClient build(ProviderConfig config, String baseUrl, Duration timeout) {
        if (config == null || !config.hasApiKey()) {
            return null;
        }
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + config.apiKey())
                .build();
    }

    /**
     * 是否具备调用条件。缺少密钥时返回 false。
     */
    public boolean isAvailable() {
        return restClient != null;
    }

    /**
     * 完整的请求地址，只用于日志。
     */
    public String endpoint(String path) {
        return baseUrl + path;
    }

    /**
     * 发一个 JSON 请求。网络层失败抛 {@link LlmCallException}，HTTP 错误状态原样返回供调用方处理。
     */
    public JsonHttpResponse post(String path, String json) {
        if (restClient == null) {
            throw new LlmCallException("未配置 API Key");
        }
        try {
            ResponseEntity<byte[]> response = restClient.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json)
                    .retrieve()
                    // 不让 RestClient 在 4xx/5xx 上自己抛异常，错误响应体同样要能打进日志
                    .onStatus(status -> true, (req, res) -> {
                    })
                    .toEntity(byte[].class);
            byte[] bytes = response.getBody();
            return new JsonHttpResponse(response.getStatusCode().value(),
                    bytes == null ? "" : new String(bytes, StandardCharsets.UTF_8));
        } catch (RestClientException e) {
            throw new LlmCallException("请求未能完成：" + e.getMessage(), e);
        }
    }
}
