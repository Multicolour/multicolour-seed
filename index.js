"use strict"

// Get the random library and use
// the basic native Math engine, randomness
// isn't really important here.
const Random = require("random-js")
const engine = Random.engines.nativeMath

// Get Async.
const Async = require("async")

class Multicolour_Seed {
  /**
   * Set some defaults.
   * @return {void}
   */
  constructor() {
    // Set iterations to a default.
    this.set_iterations(20)
    this.models_payloads = {}
  }

  /**
   * Set how many of each model you want to automatically create.
   * @param {Number} iterations to seed.
   */
  set_iterations(iterations) {
    this.iterations = Number(iterations)
    return this
  }

  /**
   * Register with Multicolour.
   * @param  {Multicolour} multicolour instance.
   * @return {void}
   */
  register(multicolour) {
    multicolour.reply("seeder", this)

    // When the server starts, try and seed.
    multicolour.on("server_starting", () => {
      // If we're not in development mode, do NOT
      // seed the database, that would be bad mkay?
      if (!process.env.NODE_ENV || process.env.NODE_ENV.toLowerCase() !== "development") {
        /* eslint-disable */
        console.error(`NODE_ENV is not "development", not seeding the database`)
        /* eslint-enable */
      }
      else {
        /* eslint-disable */
        console.log("- Seeding the database with fake data.")
        /* eslint-enable */
        // Otherwise, get the models and seed the
        // database with some random stuff.
        this.get_models_and_seed(multicolour)
      }
    })
  }

  /**
   * Get the models and generate a N payloads
   * in the database.
   *
   * @param  {Multicolour} multicolour instance running.
   * @return {void}
   */
  get_models_and_seed(multicolour) {
    // Get the registered models.
    const models = multicolour.get("database").get("models")

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

        // Add the payloads.
        this.models_payloads[model_name] = payloads
      }
    })

    // Create the tasks to run on the database.
    const tasks = Object.keys(this.models_payloads)
      .map(model_name =>
        // Create a wrapper function for Async to execute.
        next =>
          models[model_name].create(
            this.models_payloads[model_name], (err, created) => next(err, model_name, created)
          ))

    // Do the database work.
    Async.parallel(tasks, (err, created) => {
      if (err) {
        /* eslint-disable */
        console.error("- SEED - Finished seeding the database with an error")
        console.error("- SEED - ", err)
        /* eslint-enable */
      }
      else {
        // Resolve and update all created associative models.
        this.resolve_and_make_associations(created, models)
      }
    })
  }

  /**
   * Make some fake associations.
   * @param  {Array} created records to create Map from.
   * @param  {Object} models to associate.
   * @return {void}
   */
  resolve_and_make_associations(created, models) {
    // Create a map from the created array.
    const mapped_created = new Map(created)

    // Loop over the models and make the associations.
    Object.keys(models).forEach(model_name => {
      const model = models[model_name]

      // Skip junction tables.
      if (model.meta.junctionTable) {
        return
      }

      // Loop over each created model.
      mapped_created.get(model_name).forEach(created_model => {
        Object.keys(model._attributes)
          .filter(attribute_name =>
              model._attributes[attribute_name].model || model._attributes[attribute_name].collection)
          .map(attribute_name => {
            const attribute = model._attributes[attribute_name]

            // If it has a model association grab a random one.
            if (attribute.model) {
              model.update({ id: created_model.id }, {
                [attribute.model]: Random.pick(engine, mapped_created.get(attribute.model)).id
              }, () => {})
            }
            // Otherwise, grab a few random ones.
            else if (attribute.collection) {
              model.update({ id: created_model.id }, {
                [attribute.collection]: [
                  Random.pick(engine, mapped_created.get(attribute.collection)).id,
                  Random.pick(engine, mapped_created.get(attribute.collection)).id,
                  Random.pick(engine, mapped_created.get(attribute.collection)).id
                ]
              }, () => {})
            }
          })
      })
    })
  }

  /**
   * Use the attributes of a model to generate
   * a random payload to write to the database.
   *
   * @param  {Object} definition in the blueprint.
   * @return {Object} valid payload to write to the database.
   */
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

  /**
   * Generate a date between the blueprint
   * definitions or up to 10 years ago or
   * 10 years into the future (arbitrary.)
   *
   * @param  {Object} attribute to generate from.
   * @return {Date} Random date.
   */
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

  /**
   * Generate a date between the blueprint
   * definitions or between positive/negative
   * Number.MAX_SAFE_INTEGER.
   *
   * Will generate a float or an integer.
   *
   * @param  {Object} attribute to generate from.
   * @return {Number} Random number.
   */
  generate_number(attribute) {
    // Get the range
    const min = attribute.hasOwnProperty("min") ? attribute.min : -Number.MAX_SAFE_INTEGER
    const max = attribute.hasOwnProperty("max") ? attribute.max : Number.MAX_SAFE_INTEGER

    // If it's a float, generate that.
    if (attribute.type === "float" || attribute.float) {
      return Random.real(min, max)(engine)
    }
    // Otherwise, a full round number please.
    else {
      return Random.integer(min, max)(engine)
    }
  }

  /**
   * Generate a random string to the length
   * described in the blueprint or 255 characters.
   *
   * Respects, url, email & urlish
   *
   * @param  {Object} attribute to generate from.
   * @return {String} Random string.
   */
  generate_string(attribute) {
    // get the range.
    const min = attribute.hasOwnProperty("minLength") ? attribute.minLength : 50
    const max = attribute.hasOwnProperty("maxLength") ? attribute.maxLength : 255

    // If it's an enum, return a random value of it.
    if (attribute.enum) {
      return Random.pick(engine, attribute.enum)
    }

    // Generate a string.
    const long_random_string = Random.string()(engine, max)
    const short_random_string = Random.string()(engine, min)

    // Is it an email address?
    if (attribute.type === "email" || attribute.email) {
      return `${short_random_string}@${short_random_string}.com`.replace(/(_|-)/gi, "")
    }

    // Is it a url?
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

// Export the tool.
module.exports = Multicolour_Seed
