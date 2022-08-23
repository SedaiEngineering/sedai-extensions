```
npm install
curl -o lib/avlambda.zip https://github.com/SedaiEngineering/sedai-extensions/releases/download/0.1.2/avlambda.zip -J -L
cdk bootstrap --profile <profile>
```
# To get the cloudformation yaml
`cdk synth`
# To deploy
`cdk deploy --profile <profile>`