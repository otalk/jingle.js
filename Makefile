NAME = jingle
STANDALONE = Jingle
MAIN = index.js

SHELL = /bin/bash
PATH := ./node_modules/.bin:$(PATH)


# -- Tasks ------------------------------------------------------------

.PHONY: all lint test audit clean

all: test build audit

build: build/$(NAME).zip

clean:
	rm -rf build

test: lint
	node test/index.js | tap-spec

lint:
	jshint .

audit:
	nsp package


# -- Build artifacts --------------------------------------------------

build/$(NAME).zip: build/$(NAME).bundle.js build/$(NAME).bundle.min.js
	zip -j $@ $^

build/$(NAME).bundle.js: $(MAIN)
	mkdir -p build
	browserify --standalone $(STANDALONE) $(MAIN) > $@

build/$(NAME).bundle.min.js: build/$(NAME).bundle.js
	uglifyjs --screw-ie8 build/$(NAME).bundle.js > $@
