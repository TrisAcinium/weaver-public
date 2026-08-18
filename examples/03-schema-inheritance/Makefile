WEAVER_PATH ?= ../..
LOCAL_WORKSPACE = $(CURDIR)
COMPILE_TIMEOUT ?= 10s

EXEC_WEAVER = OVERRIDE_WORKSPACE=$(LOCAL_WORKSPACE) npm --prefix $(WEAVER_PATH) run
EXEC_NPM    = npm --prefix $(WEAVER_PATH) run

.PHONY: all clean compile

all: clean compile

clean:
	@echo "🧹 Cleaning previous build..."
	@$(EXEC_WEAVER) clean

compile:
	@echo "🚀 Compiling 03-schema-inheritance (Timeout: $(COMPILE_TIMEOUT))..."
	@OVERRIDE_WORKSPACE=$(LOCAL_WORKSPACE) timeout --foreground $(COMPILE_TIMEOUT) $(EXEC_NPM) compile || \
	(EXIT_CODE=$$?; \
	if [ $$EXIT_CODE -eq 124 ]; then \
		echo "\n💥 [TIMEOUT FATAL] Compilation exceeded time limit."; \
	fi; \
	exit $$EXIT_CODE)
	@echo "\n✨ Done! Check the outputs in: build/blueprints/data/employees/"
