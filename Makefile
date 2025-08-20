# Makefile for Telegram Chat ID Bot

.PHONY: help setup install build test lint clean dev start deploy-dev deploy-prod docker-build docker-run docker-stop health

# Default target
help:
	@echo "Available commands:"
	@echo "  setup        - Initial project setup"
	@echo "  install      - Install dependencies"
	@echo "  build        - Build the project"
	@echo "  test         - Run tests"
	@echo "  test-watch   - Run tests in watch mode"
	@echo "  test-coverage - Run tests with coverage"
	@echo "  lint         - Run linting"
	@echo "  lint-fix     - Fix linting issues"
	@echo "  clean        - Clean build artifacts"
	@echo "  dev          - Start development server"
	@echo "  start        - Start production server"
	@echo "  deploy-dev   - Deploy to development"
	@echo "  deploy-prod  - Deploy to production"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run   - Run Docker container"
	@echo "  docker-stop  - Stop Docker container"
	@echo "  health       - Run health check"

setup:
	@bash scripts/setup.sh

install:
	@yarn install

build:
	@yarn build

test:
	@yarn test

test-watch:
	@yarn test:watch

test-coverage:
	@yarn test:coverage

lint:
	@yarn lint

lint-fix:
	@yarn lint:fix

clean:
	@yarn clean

dev:
	@yarn dev

start:
	@yarn start

deploy-dev:
	@bash scripts/deploy.sh development

deploy-prod:
	@bash scripts/deploy.sh production

docker-build:
	@docker build -t telegram-channel-id-bot .

docker-run:
	@docker run -d --name telegram-channel-id-bot --env-file .env.production -p 3000:3000 telegram-channel-id-bot

docker-stop:
	@docker stop telegram-channel-id-bot && docker rm telegram-channel-id-bot

health:
	@bash scripts/health-check.sh