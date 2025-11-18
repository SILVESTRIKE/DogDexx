import { createClient } from "redis";
import { logger } from "./logger.util";

const redisUrl = process.env.REDIS_URL as string;

let client: ReturnType<typeof createClient> | null = null;

if (!redisUrl) {
  logger.warn("REDIS_URL is not defined. Guest token limiter will not work.");
} else {
  client = createClient({
    url: redisUrl,
    socket: {
      tls: true,
      rejectUnauthorized: false, // Dòng này QUAN TRỌNG NHẤT
    },
  });

  client.on("connect", () => {});

  client.on("ready", () => {
    logger.info("[Redis] Connection on " + redisUrl);
  });

  client.on("error", (err) => {
    logger.error("[Redis] Redis Client Error", err);
  });

  client.connect();
}

export const redisClient = client;
