FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

RUN chmod +x mvnw

COPY src/ src/

RUN ./mvnw -DskipTests clean package


FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S taskflow \
    && adduser -S taskflow -G taskflow

COPY --from=build \
    /workspace/target/ControlPlane-0.0.1-SNAPSHOT.jar \
    /app/app.jar

USER taskflow

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]