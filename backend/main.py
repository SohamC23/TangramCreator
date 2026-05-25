from fastapi import FastAPI, HTTPException, Query

from basemodels import GenerateTangramRequest
import gramtan_generate as gg
import gramtan_check_solved as gcs

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Tangram Creator API")


# Allow React frontend to connect and bypass CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post("/api/generate-tangram")
def generate_tangram(request: GenerateTangramRequest):
    shapes = gcs.build_shapes(request.shapes)
    try:
        tangram = gg.generate_puzzle(shapes, True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if tangram is None:
        raise HTTPException(status_code=500, detail="Tangram generation failed")

    serialized = gcs.serialize_shape(tangram)
    gcs.last_tangram["combined_shape"] = serialized
    gcs.last_tangram["serialized"] = {
        "combined_shape": serialized,
        "original_shape_count": len(shapes),
    }

    return gcs.last_tangram["serialized"]


@app.get("/api/get-tangram")
def get_tangram():
    if gcs.last_tangram["combined_shape"] is None:
        raise HTTPException(status_code=404, detail="No tangram has been generated yet")
    return gcs.last_tangram["serialized"]


@app.get("/check-svg")
def check_svg(svg: str = Query(..., description="SVG markup to check against the last generated tangram")):
    if gcs.last_tangram["combined_shape"] is None:
        raise HTTPException(status_code=404, detail="No tangram has been generated yet")

    try:
        polygons = gcs.extract_svg_polygons(svg)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not polygons:
        raise HTTPException(status_code=400, detail="SVG did not contain any supported polygon or path data")

    expected = gcs.last_tangram["combined_shape"]["coordinates"]
    match = any(gcs._polygon_matches(expected, polygon) for polygon in polygons)

    return {
        "matches": match,
        "expected_coordinate_count": len(expected),
        "polygon_count": len(polygons),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="localhost", port=8000)

