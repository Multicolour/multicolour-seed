# Multicolour Seed

`npm i --save multicolour-seed`

Seed your development environment with randomly generated dummy data.

Simply `.use(require("multicolour-seed"))` to seed your database, it will
*only* run if `NODE_ENV` is equal to `"development"` and will run every time
the server is started and does not clean up after itself.

By default it will create `20` of each model registered, to change this update
your `.use` statement to the below

```js
...
my_service.use(require("multicolour-seed"))
  .request("seeder").set_iterations(1000)
...
```

MIT 2016
