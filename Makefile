jspm_packages: node_packages package.json
	jspm install

node_packages: package.json
	npm install

dist/main.js: src/*.js
	npx webpack
