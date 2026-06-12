# Tangram Puzzle Generator & 3D-Printed Set

## About
A full-stack web application for generating, customizing, and solving tangram puzzles. Define your own puzzle pieces, generate combined target shapes from them, and solve the resulting puzzles interactively with drag-and-drop, rotation, flipping, and automatic snapping.

## Running the Project
Just go to https://main.d3g9m7pl8ansh7.amplifyapp.com/

## Tech Stack:

## Frontend

React (with Vite) using:
 - axios for API requests

## Backend
Python using: 
- FastAPI with uvicorn
- Shapely for polygon geometry (union, symmetric difference, area comparison)
- Pydantic models for request validation

## Infrastructure
- AWS Amplify to deploy frontend
- AWS Lambda to house a scalable backend
- AWS Cognito for holding the user pool
- AWS DynamoDB to hold account information and data stored in the account

## Features
- From the dashboard, you can generate a puzzle from the current piece set, and the backend assembles the pieces into a tangram puzzle and opens the solver pop-up with said puzzle
- Past puzzles that were created can be viewed or solved again and are displayed alongside stats for puzzles generated, puzzles solved, and current piece count.
- The piece creator lets you build custom pieces by entering vertex coordinates with a live graph preview, and it lets you name individual pieces and presets, update/duplicate/delete pieces. The custom pieces are saved as a preset, and then a puzzle can be generated with those custom pieces.
- You can also easily switch between presets at the top of the page; the built-in default tangram is chosen upon opening the page
- Clicking a puzzle (or generating one) opens an interactive solver where you can place pieces by clicking them into the canvas, drag them freely, rotate them clockwise (45° at a time), flip them horizontally. The piece's corners also snap to the nearest corner of the puzzle outline or other pieces
- In the solver, a timer tracks solve time, "Show solution" shows a solved solution the puzzle was generated from, "Reset" clears the canvas, and "Check Solved" user has arranged a valid solution to the puzzle
- You can sign in and create an account for the website (future versions will save presets to your account). Account login persists so that users stay logged in even if the tab closes. They can log out by clicking the account and then the log out button.

## Known Limitations / Coming Soon
The following features are present in the UI but not yet functional. They will be implemented in a future update:

- Export STL — the thickness and scale inputs and the STL download button in the STL Export section are placeholders. STL generation for 3D printing is not yet wired up.
- Export / Download SVG — the SVG download buttons (in both the STL Export section and the solver) do not yet produce a file.

Other areas planned for future work:

- Persisting puzzles and presets across sessions using AWS. While accounts can be made currently, the presets a person creates aren't being saved to the account, so a future patch will fix that

## Author

**Soham Chouhan**  
GitHub: [SohamC23](https://github.com/SohamC23)  
LinkedIn: [soham-chouhan](https://www.linkedin.com/in/soham-chouhan/)

## License

This project uses the GNU GENERAL PUBLIC LICENSE v3.0
