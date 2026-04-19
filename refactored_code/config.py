"""应用配置 - 重构版"""
import os
from pydantic import BaseModel, SecretStr, field_validator


class Settings(BaseModel):
    """全局配置"""
    # 大模型 API 配置
    llm_api_url: str = os.getenv("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
    llm_api_key: SecretStr = SecretStr(os.getenv("LLM_API_KEY", ""))
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4o")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))
    llm_timeout: float = float(os.getenv("LLM_TIMEOUT", "120.0"))

    # 服务配置
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8100"))
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"

    # 安全配置
    allowed_origins: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "100"))

    # 代码输入限制
    max_code_length: int = int(os.getenv("MAX_CODE_LENGTH", "50000"))

    @field_validator('allowed_origins', mode='before')
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',') if origin.strip()]
        return v

    def get_api_key(self) -> str:
        """安全获取 API Key"""
        return self.llm_api_key.get_secret_value()


settings = Settings()
