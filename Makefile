# ==============================================================================
#  USER CONFIGURATION
#  Modify according to your project needs.
# ==============================================================================

WEAVER_PATH = ./
LOCAL_WORKSPACE = $(CURDIR)

# ==============================================================================
#  DO NOT EDIT BELOW THIS LINE
#  Compiler core execution logic
# ==============================================================================

.PHONY: all lint compile clean test debug prof prof-process

EXEC_WEAVER = OVERRIDE_WORKSPACE=$(LOCAL_WORKSPACE) npm --prefix $(WEAVER_PATH) run

all: lint compile

lint:
	@$(EXEC_WEAVER) lint

compile:
	@$(EXEC_WEAVER) compile

clean:
	@$(EXEC_WEAVER) clean

test:
	@$(EXEC_WEAVER) test

debug:
	@OVERRIDE_WORKSPACE=$(LOCAL_WORKSPACE) node inspect $(WEAVER_PATH)/src/compile.js

prof:
	@OVERRIDE_WORKSPACE=$(LOCAL_WORKSPACE) node --prof $(WEAVER_PATH)/src/compile.js

prof-process:
	@OVERRIDE_WORKSPACE=$(LOCAL_WORKSPACE) node --prof-process isolate-*.log > result.txt
