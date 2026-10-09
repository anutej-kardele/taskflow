package telemetry

import (
	"context"
	"strings"

	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
)

type KafkaHeaderCarrier struct {
	Headers []kafka.Header
}

func (c *KafkaHeaderCarrier) Get(key string) string {

	for i := len(c.Headers) - 1; i >= 0; i-- {

		if strings.EqualFold(
			c.Headers[i].Key,
			key,
		) {
			return string(
				c.Headers[i].Value,
			)
		}
	}

	return ""
}

func (c *KafkaHeaderCarrier) Set(
	key string,
	value string,
) {

	c.Headers = append(
		c.Headers,
		kafka.Header{
			Key:   key,
			Value: []byte(value),
		},
	)
}

func (c *KafkaHeaderCarrier) Keys() []string {

	keys := make(
		[]string,
		0,
		len(c.Headers),
	)

	for _, header := range c.Headers {
		keys = append(
			keys,
			header.Key,
		)
	}

	return keys
}

func ExtractKafkaContext(
	ctx context.Context,
	headers []kafka.Header,
) context.Context {

	carrier := &KafkaHeaderCarrier{
		Headers: headers,
	}

	return otel.GetTextMapPropagator().
		Extract(
			ctx,
			carrier,
		)
}
