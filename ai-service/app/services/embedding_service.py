from app.services.model_gateway import ModelGateway, ModelGatewayError


class EmbeddingService:
    def __init__(self, gateway: ModelGateway, expected_dimensions: int) -> None:
        self._gateway = gateway
        self._expected_dimensions = expected_dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._gateway.embed(texts)
        if len(vectors) != len(texts):
            raise ModelGatewayError("Embedding provider returned the wrong number of vectors.")
        for vector in vectors:
            if len(vector) != self._expected_dimensions:
                raise ModelGatewayError(
                    "Embedding dimension does not match EMBEDDING_DIMENSIONS / database schema."
                )
        return vectors
