.PHONY: build start stop

build:
	npm install
	npm run build

start: build
	docker-compose up -d

stop:
	docker-compose down
