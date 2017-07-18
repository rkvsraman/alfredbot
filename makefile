BUCKET := alfredbot

build:
	touch alfredbot.zip && rm alfredbot.zip && cd bot && yarn install && zip -r ../alfredbot.zip  index.js package.json template.yaml

upload:
	aws s3 cp alfredbot.zip s3://$(BUCKET)/functions/alfredbot.zip

create:
	aws lambda create-function \
		--region us-east-1 \
		--function-name alfredbot \
		--runtime nodejs4.3 \
		--handler index.handler \
		--role arn:aws:iam::680330217679:role/lambda_basic_execution \
		--code S3Bucket=$(BUCKET),S3Key=functions/alfredbot.zip

update:
	aws lambda update-function-code \
    --region us-east-1 \
    --function-name alfredbot \
    --s3-bucket $(BUCKET) \
    --s3-key functions/alfredbot.zip

release: deploy
	VERSION=$$(aws lambda publish-version --region us-east-1 --function-name alfredbot | jq -r .Version); \
	aws lambda update-alias --function-name alfredbot --region us-east-1 --function-version $$VERSION --name PROD

deploy: build upload update

setup: build upload create
