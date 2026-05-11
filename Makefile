DENO_VERSION := 2.6.6
DENO_BIN     := src/nl_agent/bin/deno

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Darwin)
    ifeq ($(UNAME_M),arm64)
        DENO_TARGET := aarch64-apple-darwin
    else
        DENO_TARGET := x86_64-apple-darwin
    endif
else ifeq ($(UNAME_S),Linux)
    ifeq ($(UNAME_M),aarch64)
        DENO_TARGET := aarch64-unknown-linux-gnu
    else
        DENO_TARGET := x86_64-unknown-linux-gnu
    endif
else
    $(error Unsupported platform: $(UNAME_S))
endif

DENO_URL   := https://github.com/denoland/deno/releases/download/v$(DENO_VERSION)/deno-$(DENO_TARGET).zip
PY_SOURCES := $(shell find src/ -name "*.py")

.PHONY: build deno-download clean

## Build the wheel (downloads Deno first if missing)
build: $(DENO_BIN) $(PY_SOURCES)
	uv build

## Download the Deno binary for the current platform
$(DENO_BIN): | src/nl_agent/bin
	curl -fsSL $(DENO_URL) -o /tmp/deno-download.zip
	unzip -o /tmp/deno-download.zip deno -d src/nl_agent/bin/
	chmod +x $(DENO_BIN)
	rm /tmp/deno-download.zip

deno-download: $(DENO_BIN)

src/nl_agent/bin:
	mkdir -p src/nl_agent/bin

clean:
	rm -rf dist/ src/nl_agent/bin/deno src/nl_agent/bin/deno.exe
