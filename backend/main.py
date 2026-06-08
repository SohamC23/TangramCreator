from fastapi import FastAPI, HTTPException, Query
from mangum import Mangum

from basemodels import GenerateTangramRequest
from basemodels import CheckSVGRequest
import gramtan_generate as gg
import gramtan_check_solved as gcs

from fastapi.middleware.cors import CORSMiddleware

API_BASE_URL = "/api"


app = FastAPI(title="Tangram Creator API")


# Allow React frontend to connect and bypass CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://main.d3g9m7pl8ansh7.amplifyapp.com/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/generate-tangram")
def generate_tangram(request: GenerateTangramRequest):
    print("request before:", request)
    shapes = gcs.build_shapes(request.shapes)
    print("shapes:", shapes)
    try:
        tangramInfo = gg.generate_puzzle(shapes, False)
        print("tangramInfo type:", type(tangramInfo))
        print("tangramInfo[0] type:", type(tangramInfo[0]))
        print("tangramInfo[0]:", tangramInfo[0])
        print("tangramInfo[1] type:", type(tangramInfo[1]))
        if tangramInfo[1]:
            print("tangramInfo[1][0]:", tangramInfo[1][0])
        tangram = tangramInfo[0]
        solvedShapes = tangramInfo[1]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if tangram is None:
        print("Tangram generation failed: " + tangram)
        raise HTTPException(status_code=500, detail="Tangram generation failed")

    serialized = gcs.serialize_shape(tangram)
    for i in range(0, len(solvedShapes)):
        solvedShapes[i] = gcs.serialize_shape(solvedShapes[i])

    return {
        "combined_shape": serialized,
        "original_shape_count": len(shapes),
        "solved_shapes": solvedShapes,
    }


@app.post("/api/check-svg")
def check_svg(request: CheckSVGRequest):

    print("\n\ntrying to check solution\n\n")
    print("DEBUG: placed_svg length:", len(request.placed_svg))
    print("DEBUG: expected_svg length:", len(request.expected_svg))
    print("DEBUG: placed_svg start:", request.placed_svg[:200])  # first 200 chars
    print("DEBUG: expected_svg start:", request.expected_svg[:200])
    
    try:
        result = gcs.check_svgs_match(request.placed_svg, request.expected_svg)
    except ValueError as exc:
        print("DEBUG: ValueError raised:", str(exc))
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        print("DEBUG: Unexpected error:", str(exc))
        raise HTTPException(status_code=500, detail=str(exc))

    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="localhost", port=8000)

handler = Mangum(app)
