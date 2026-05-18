import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

/**
 * Dev pretty-print via an inline stream (not `transport`), so Next.js does not spawn
 * a pino worker thread — those workers break under Webpack and cause 500s on log.
 */
export const logger: pino.Logger = isDev
  ? pino(
      { level },
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("pino-pretty")({
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
      }),
    )
  : pino({ level });
