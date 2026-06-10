import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "us-east-2_ndJWEH3Xr",        // your User Pool ID
      userPoolClientId: "347smm6ujqrd22uobv9np0nkog", // your App Client ID
    },
  },
});