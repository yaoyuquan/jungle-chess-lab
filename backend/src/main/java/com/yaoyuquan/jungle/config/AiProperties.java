package com.yaoyuquan.jungle.config;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/**
 * AI 相关的全部配置，绑定 application.yml 中的 jungle.ai 节点。
 * <p>
 * providers 是一个具名连接池，棋手通过 provider 字段引用其中一条，
 * 因此不同棋手可以分属不同服务商。
 *
 * @param providers       具名连接池，key 是连接名
 * @param defaultProvider 棋手未指定 provider 时使用的连接名
 * @param timeout         单次大模型调用超时
 * @param maxRetries      大模型返回非法着法时的最大重试次数
 * @param logPayloads     是否把发给模型的请求与模型的原始响应打到日志，排查问题用，默认开
 * @param players         棋手清单
 * @author yaoyuquan
 */
@ConfigurationProperties(prefix = "jungle.ai")
public record AiProperties(
        Map<String, ProviderConfig> providers,
        String defaultProvider,
        Duration timeout,
        Integer maxRetries,
        Boolean logPayloads,
        List<AiPlayer> players) {

    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(60);
    private static final int DEFAULT_MAX_RETRIES = 2;

    /**
     * 按 id 查找棋手。
     */
    public Optional<AiPlayer> findPlayer(String playerId) {
        if (players == null || playerId == null) {
            return Optional.empty();
        }
        return players.stream().filter(p -> playerId.equals(p.id())).findFirst();
    }

    /**
     * 解析棋手应当使用的连接名。棋手没写就落到 default-provider，还没有就取连接池里的第一条。
     */
    public Optional<String> resolveProviderName(AiPlayer player) {
        if (player != null && StringUtils.hasText(player.provider())) {
            return Optional.of(player.provider());
        }
        if (StringUtils.hasText(defaultProvider)) {
            return Optional.of(defaultProvider);
        }
        return providersOrEmpty().keySet().stream().findFirst();
    }

    /**
     * 按名字取连接配置。
     */
    public Optional<ProviderConfig> provider(String name) {
        if (name == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(providersOrEmpty().get(name));
    }

    public Map<String, ProviderConfig> providersOrEmpty() {
        return providers == null ? Map.of() : providers;
    }

    public Duration timeoutOrDefault() {
        return timeout == null ? DEFAULT_TIMEOUT : timeout;
    }

    /**
     * 是否打印请求与响应。没配置时默认打开，因为这是个实验项目，出问题时能直接看到原始报文更重要。
     */
    public boolean logPayloadsOrDefault() {
        return logPayloads == null || logPayloads;
    }

    public int maxRetriesOrDefault() {
        return maxRetries == null ? DEFAULT_MAX_RETRIES : maxRetries;
    }

    public List<AiPlayer> playersOrEmpty() {
        return players == null ? List.of() : players;
    }
}
