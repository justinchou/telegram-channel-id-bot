import winston from "winston";
import { createChildLogger, LogLevel } from "../../src/utils/logger";

// Mock winston to avoid actual file operations during tests
jest.mock("winston", () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    http: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
    exceptions: {
      handle: jest.fn(),
    },
    rejections: {
      handle: jest.fn(),
    },
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      colorize: jest.fn(),
      printf: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
    addColors: jest.fn(),
  };
});

describe("Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("logger instance", () => {
    it("should create winston logger with correct configuration", () => {
      expect(winston.createLogger).toHaveBeenCalledWith({
        level: "info", // Default when LOG_LEVEL is not set
        levels: {
          error: 0,
          warn: 1,
          info: 2,
          http: 3,
          debug: 4,
        },
        transports: expect.any(Array),
        exitOnError: false,
      });
    });

    it("should use LOG_LEVEL environment variable when set", () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = "debug";

      // Re-import to get new logger with updated env var
      jest.resetModules();
      require("../../src/utils/logger");

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
        })
      );

      process.env.LOG_LEVEL = originalLogLevel;
    });

    it("should configure exception and rejection handlers", () => {
      const mockLogger = (winston.createLogger as jest.Mock).mock.results[0].value;

      expect(mockLogger.exceptions.handle).toHaveBeenCalledWith(
        expect.any(Object) // File transport for exceptions
      );

      expect(mockLogger.rejections.handle).toHaveBeenCalledWith(
        expect.any(Object) // File transport for rejections
      );
    });
  });

  describe("createChildLogger", () => {
    it("should create child logger with context", () => {
      const mockLogger = (winston.createLogger as jest.Mock).mock.results[0].value;
      const mockChildLogger = { info: jest.fn() };
      mockLogger.child.mockReturnValue(mockChildLogger);

      const context = { userId: 123, chatId: 456 };
      const childLogger = createChildLogger(context);

      expect(mockLogger.child).toHaveBeenCalledWith(context);
      expect(childLogger).toBe(mockChildLogger);
    });
  });

  describe("LogLevel enum", () => {
    it("should export correct log levels", () => {
      expect(LogLevel.ERROR).toBe("error");
      expect(LogLevel.WARN).toBe("warn");
      expect(LogLevel.INFO).toBe("info");
      expect(LogLevel.HTTP).toBe("http");
      expect(LogLevel.DEBUG).toBe("debug");
    });
  });

  describe("winston configuration", () => {
    it("should add colors to winston", () => {
      expect(winston.addColors).toHaveBeenCalledWith({
        error: "red",
        warn: "yellow",
        info: "green",
        http: "magenta",
        debug: "white",
      });
    });

    it("should create console and file transports", () => {
      expect(winston.transports.Console).toHaveBeenCalled();
      expect(winston.transports.File).toHaveBeenCalledTimes(2); // error.log and combined.log
    });

    it("should configure file transports correctly", () => {
      const fileTransportCalls = (winston.transports.File as jest.Mock).mock.calls;

      // Error log transport
      expect(fileTransportCalls[0][0]).toEqual({
        filename: "logs/error.log",
        level: "error",
        format: expect.anything(),
      });

      // Combined log transport
      expect(fileTransportCalls[1][0]).toEqual({
        filename: "logs/combined.log",
        format: expect.anything(),
      });
    });
  });

  describe("format configuration", () => {
    it("should configure console format with timestamp and colors", () => {
      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalledWith({
        format: "YYYY-MM-DD HH:mm:ss:ms",
      });
      expect(winston.format.colorize).toHaveBeenCalledWith({ all: true });
      expect(winston.format.printf).toHaveBeenCalled();
    });

    it("should configure file format with timestamp and JSON", () => {
      expect(winston.format.timestamp).toHaveBeenCalledWith({
        format: "YYYY-MM-DD HH:mm:ss:ms",
      });
      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
      expect(winston.format.json).toHaveBeenCalled();
    });
  });
});
