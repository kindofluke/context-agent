DENO_VERSION := 2.6.6
DENO_BIN     := src/context_agent/bin/deno

# Cloud Run deployment configuration
GCP_PROJECT_ID    ?= amazing-greetings
GCP_REGION        ?= us-central1
BACKEND_SERVICE   ?= context-agent
FRONTEND_SERVICE  ?= context-agent-frontend
BACKEND_IMAGE     := gcr.io/$(GCP_PROJECT_ID)/$(BACKEND_SERVICE)
FRONTEND_IMAGE    := gcr.io/$(GCP_PROJECT_ID)/$(FRONTEND_SERVICE)

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

.PHONY: build deno-download clean \
        backend-build backend-deploy \
        frontend-build frontend-deploy \
        setup-iam deploy-all

## Build the wheel (downloads Deno first if missing)
build: $(DENO_BIN) $(PY_SOURCES)
	uv build

## Download the Deno binary for the current platform
$(DENO_BIN): | src/context_agent/bin
	curl -fsSL $(DENO_URL) -o /tmp/deno-download.zip
	unzip -o /tmp/deno-download.zip deno -d src/context_agent/bin/
	chmod +x $(DENO_BIN)
	rm /tmp/deno-download.zip

deno-download: $(DENO_BIN)

src/context_agent/bin:
	mkdir -p src/context_agent/bin

clean:
	rm -rf dist/ src/context_agent/bin/deno src/context_agent/bin/deno.exe

## Build backend Docker image using Google Cloud Build
backend-build:
	@echo "📦 Building backend image with Cloud Build: $(BACKEND_IMAGE):latest"
	gcloud builds submit \
		--tag $(BACKEND_IMAGE):latest \
		--project $(GCP_PROJECT_ID) \
		--timeout 20m \
		.

## Deploy backend to Cloud Run (PRIVATE - requires service-to-service auth)
backend-deploy: backend-build
	@echo "🔒 Deploying PRIVATE backend to Cloud Run..."
	@echo "  Project: $(GCP_PROJECT_ID)"
	@echo "  Region: $(GCP_REGION)"
	@echo "  Service: $(BACKEND_SERVICE)"
	gcloud run deploy $(BACKEND_SERVICE) \
		--image $(BACKEND_IMAGE):latest \
		--platform managed \
		--region $(GCP_REGION) \
		--no-allow-unauthenticated \
		--session-affinity \
		--min-instances 1 \
		--max-instances 10 \
		--memory 2Gi \
		--cpu 2 \
		--timeout 300 \
		--set-env-vars "OPENAI_API_KEY=$(OPENAI_API_KEY)" \
		--set-env-vars "OPENAI_MODEL_NAME=$(OPENAI_MODEL_NAME)" \
		--set-env-vars "CT_PY_FRED_API_KEY=$(CT_PY_FRED_API_KEY)" \
		--set-env-vars "OPENAI_BASE_URL=$(OPENAI_BASE_URL)" \
		--project $(GCP_PROJECT_ID)
	@echo ""
	@echo "✅ Backend deployment complete!"
	@echo "🔒 Backend URL (private):"
	@gcloud run services describe $(BACKEND_SERVICE) \
		--platform managed \
		--region $(GCP_REGION) \
		--format 'value(status.url)' \
		--project $(GCP_PROJECT_ID)

## Copy examples into docs-site for frontend build
frontend-prepare:
	@echo "📋 Copying examples into docs-site..."
	rm -rf docs-site/examples
	cp -r examples docs-site/examples

## Build frontend Docker image using Google Cloud Build
frontend-build: frontend-prepare
	@echo "📦 Building frontend image with Cloud Build: $(FRONTEND_IMAGE):latest"
	cd docs-site && gcloud builds submit \
		--tag $(FRONTEND_IMAGE):latest \
		--project $(GCP_PROJECT_ID) \
		--timeout 20m \
		.

## Deploy frontend to Cloud Run (PUBLIC)
frontend-deploy: frontend-build
	@echo "🌐 Deploying PUBLIC frontend to Cloud Run..."
	@echo "  Project: $(GCP_PROJECT_ID)"
	@echo "  Region: $(GCP_REGION)"
	@echo "  Service: $(FRONTEND_SERVICE)"
	$(eval BACKEND_URL := $(shell gcloud run services describe $(BACKEND_SERVICE) --platform managed --region $(GCP_REGION) --format 'value(status.url)' --project $(GCP_PROJECT_ID)))
	gcloud run deploy $(FRONTEND_SERVICE) \
		--image $(FRONTEND_IMAGE):latest \
		--platform managed \
		--region $(GCP_REGION) \
		--allow-unauthenticated \
		--session-affinity \
		--min-instances 1 \
		--max-instances 10 \
		--memory 1Gi \
		--cpu 1 \
		--timeout 60 \
		--set-env-vars "BACKEND_SERVICE_URL=$(BACKEND_URL)" \
		--project $(GCP_PROJECT_ID)
	@echo ""
	@echo "✅ Frontend deployment complete!"
	@echo "🌍 Frontend URL (public):"
	@gcloud run services describe $(FRONTEND_SERVICE) \
		--platform managed \
		--region $(GCP_REGION) \
		--format 'value(status.url)' \
		--project $(GCP_PROJECT_ID)

## Setup IAM permissions for frontend to invoke backend
setup-iam:
	@echo "🔐 Setting up IAM permissions..."
	@echo "Granting frontend service account permission to invoke backend..."
	$(eval PROJECT_NUMBER := $(shell gcloud projects describe $(GCP_PROJECT_ID) --format='value(projectNumber)'))
	gcloud run services add-iam-policy-binding $(BACKEND_SERVICE) \
		--member="serviceAccount:$(PROJECT_NUMBER)-compute@developer.gserviceaccount.com" \
		--role="roles/run.invoker" \
		--region=$(GCP_REGION) \
		--project=$(GCP_PROJECT_ID)
	@echo "✅ IAM permissions configured!"

## Deploy everything (backend + frontend + IAM setup)
deploy-all: backend-deploy frontend-deploy setup-iam
	@echo ""
	@echo "🎉 Full deployment complete!"
	@echo ""
	@echo "📋 Service URLs:"
	@echo "  Backend (private): $$(gcloud run services describe $(BACKEND_SERVICE) --platform managed --region $(GCP_REGION) --format 'value(status.url)' --project $(GCP_PROJECT_ID))"
	@echo "  Frontend (public): $$(gcloud run services describe $(FRONTEND_SERVICE) --platform managed --region $(GCP_REGION) --format 'value(status.url)' --project $(GCP_PROJECT_ID))"
	@echo ""
	@echo "✨ Visit the frontend URL to use the playground!"
