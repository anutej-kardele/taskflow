package telemetry

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func SetupTracing(ctx context.Context, nodeID string, endpoint string) (func(context.Context) error, error) {

	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithEndpoint(endpoint), otlptracegrpc.WithInsecure())

	if err != nil {
		return nil, fmt.Errorf("create OTLP trace exporter: %w", err)
	}

	res := resource.NewWithAttributes(
		"",
		attribute.String("service.name", "taskflow-worker"),
		attribute.String("service.instance.id", nodeID),
		attribute.String("taskflow.node.id", nodeID),
	)

	tracerProvider := sdktrace.NewTracerProvider(sdktrace.WithSyncer(exporter), sdktrace.WithResource(res))

	otel.SetTracerProvider(tracerProvider)

	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))

	return tracerProvider.Shutdown, nil
}
