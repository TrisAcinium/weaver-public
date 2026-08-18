# ==============================================================================
# WEAVER EXAMPLE MAKEFILE
# ==============================================================================

# Define the Weaver core engine directory (current example is in examples/01-hello-weaver)
WEAVER_PATH ?= ../..

# Absolute path of the current workspace
LOCAL_WORKSPACE = $(CURDIR)

# Examples are usually fast, so the timeout is safely set to 10 seconds
COMPILE_TIMEOUT ?= 10s

# NPM cross-directory execution wrappers
EXEC_WEAVER = OVERRIDE_WORKSPACE=$(LOCAL_WORKSPACE) npm --prefix $(WEAVER_PATH) run
EXEC_NPM    = npm --prefix $(WEAVER_PATH) run

.PHONY: all clean compile bundle

# Default execution flow: clean -> compile
all: clean compile

clean:
	@echo "🧹 Cleaning previous build..."
	@$(EXEC_WEAVER) clean

compile:
	@echo "🚀 Compiling 01-hello-weaver (Timeout: $(COMPILE_TIMEOUT))..."
	@OVERRIDE_WORKSPACE=$(LOCAL_WORKSPACE) timeout --foreground $(COMPILE_TIMEOUT) $(EXEC_NPM) compile || \
	(EXIT_CODE=$$?; \
	if [ $$EXIT_CODE -eq 124 ]; then \
		echo "\n💥 [TIMEOUT FATAL] Compilation exceeded the time limit of $(COMPILE_TIMEOUT). Deadlock protection triggered! Process aborted."; \
	fi; \
	exit $$EXIT_CODE)
	@echo "\n✨ Done! Check the output at: build/blueprints/data/alice-profile.json"
