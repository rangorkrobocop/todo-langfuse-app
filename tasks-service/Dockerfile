# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Download dependencies first (layer-cached unless pom.xml changes)
COPY tasks-service/pom.xml .
RUN mvn dependency:go-offline -q

# Build the fat JAR
COPY tasks-service/src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
COPY --from=builder /app/target/tasks-service-*.jar app.jar

EXPOSE 4002

ENTRYPOINT ["java", "-jar", "app.jar"]
