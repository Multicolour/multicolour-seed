"use strict"

// Get the random library and use
// the basic native Math engine, randomness
// isn't really important here.
const Random = require("random-js")
const engine = Random.engines.nativeMath

class Multicolour_Seed {
  constructor() {
    this.set_iterations(10)

    this.models_payloads = {}
  }

  set_iterations(iterations) {
    this.iterations = Number(iterations)
  }

  /**
   * Register with Multicolour.
   * @param  {Multicolour} multicolour instance.
   * @return {void}
   */
  register(multicolour) {
    // When the server starts, try and seed.
    multicolour.on("server_starting", () => {
      // If we're not in development mode, do NOT
      // seed the database, that would be bad mkay?
      if (!process.env.NODE_ENV || process.env.NODE_ENV.toLowerCase() !== "development") {
        /* eslint-disable */
        console.log(`NODE_ENV is not "development", not seeding the database`)
        /* eslint-enable */
      }
      else {
        // Otherwise, get the models and seed the
        // database with some random stuff.
        this.get_models_and_seed(multicolour)
      }
    })
  }

  /**
   * Get the models and generate a few payloads
   * @param  {[type]} multicolour [description]
   * @return {[type]}             [description]
   */
  get_models_and_seed(multicolour) {
    // Get the registered models.
    const models = multicolour.get("database").get("models")

    // Get Async.
    const Async = require("async")

    // Loop over each model.
    Object.keys(models).forEach(model_name => {
      // Makes the rest of the function more readable.
      const model = models[model_name]

      // Where we'll push the payloads
      const payloads = []

      // Check it's not a junctionTable
      // and skip if it is.
      if (model.meta.junctionTable) {
        return
      }
      else {
        // Create N of each model.
        for (let i = 0; i < this.iterations; i++) {
          payloads.push(this.generate_payload_from_definition(model._attributes))
        }

        this.models_payloads[model_name] = payloads
      }
    })

    // console.log(this.models_payloads);

    const tasks = Object.keys(this.models_payloads)
      .map(model_name => next => models[model_name].create(this.models_payloads[model_name], next))

    // Do the database work.
    Async.parallel(tasks, (err, created) => {
      if (err) {
        console.error(" - SEED - Finished seeding the database with an error")
        console.error(" - SEED - ", err)
      }
      else {
        console.log(" - SEED - Finished seeding the database with random data.")
        console.log(created);
      }
    })
  }

  generate_payload_from_definition(definition) {
    // Start with an empty object.
    const payload = {}

    // Loop over each defined property
    // that isn't an association because we'll
    // deal with that later and check it isn't
    // an id or _id since that's upto the database.
    Object.keys(definition).forEach(attribute_name => {
      if (
        definition[attribute_name].model ||
        definition[attribute_name].collection ||
        attribute_name === "id" ||
        attribute_name === "_id"
      ) {
        return
      }

      // Do something different per type.
      switch (definition[attribute_name].type.toLowerCase()) {
      case "email":
      case "string":
        payload[attribute_name] = this.generate_string(definition[attribute_name])
        break
      case "integer":
      case "float":
        // If it's the primary key, let the database handle it.
        if (definition[attribute_name].primaryKey) {
          break
        }
        payload[attribute_name] = this.generate_number(definition[attribute_name])
        break
      case "date":
      case "time":
      case "datetime":
        payload[attribute_name] = this.generate_date(definition[attribute_name])
        break
      case "boolean":
        payload[attribute_name] = Random.bool()(engine)
        break
      }
    })

    return payload
  }

  generate_date(attribute) {
    // Create some default dates.
    const current_date = new Date()
    const default_before = new Date(current_date.getFullYear() - 10, 1, 1)
    const default_after = new Date(current_date.getFullYear() + 10, 12, 31)

    // Return a random date.
    return Random.date(
      attribute.before && attribute.before() || default_before,
      attribute.after && attribute.after() || default_after
    )(engine)
  }

  generate_number(attribute) {
    // Get the range
    const min = attribute.min || -Number.MAX_SAFE_INTEGER
    const max = attribute.max || Number.MAX_SAFE_INTEGER

    // If it's a float, generate that.
    if (attribute.type === "float" || attribute.float) {
      return Random.real(min, max)(engine)
    }
    // Otherwise, a full round number please.
    else {
      return Random.integer(min, max)(engine)
    }
  }

  generate_string(attribute) {
    // If it's an enum, return a random value of it.
    if (attribute.enum) {
      return Random.pick(engine, attribute.enum)
    }

    // Generate a string.
    const long_random_string = Random.string()(engine, attribute.maxLength || 255)
    const short_random_string = Random.string()(engine, attribute.maxLength || 50)

    if (attribute.type === "email" || attribute.email) {
      return `${short_random_string}@${short_random_string}.com`.replace(/(_|-)/gi, "")
    }

    // is it a url?
    if (attribute.url) {
      return `http://${short_random_string}.com`.replace(/(_|-)/gi, "")
    }

    // Is it urlish? A uri..
    if (attribute.urlish) {
      return `/${short_random_string}`
    }

    // Otherwise, return the random string.
    return long_random_string
  }
}

module.exports = Multicolour_Seed
