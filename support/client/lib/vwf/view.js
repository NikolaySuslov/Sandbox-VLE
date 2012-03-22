"use strict";
define( [ "module", "vwf/api/kernel", "vwf/api/view", "logger" ], function( module, kernel_api, view_api ) {  // TODO: remove explicit reference to vwf / require( "vwf-proxy" )

    // vwf/view.js is the common implementation of all Virtual World Framework views. Views
    // interpret information from the simulation, present it to the user, and accept user input
    // influencing the simulation.
    //
    // Views are outside of the simulation. Unlike models, they may accept external input--such as
    // pointer and key events from a user--but may only affect the simulation indirectly through the
    // synchronization server.
    // 
    // vwf/view and all deriving views are loaded as RequireJS (http://requirejs.org) modules.

    // TODO: most of this is the same between vwf/model.js and vwf/view.js. Find a way to share.

    var logger = require( "logger" ).for( module.id.replace( /\//g, "." ) );

    logger.infoc( "load" );

    return {

        module: module,

        logger: logger,

        load: function( module, initializer, kernelGenerator, viewGenerator ) {

            var instance = Object.create( this );

            instance.module = module;
            instance.logger = require( "logger" ).for( instance.module.id.replace( /\//g, "." ) );
            
            instance.logger.infoc( "load" );

            if ( typeof initializer == "function" || initializer instanceof Function ) {
                initializer = initializer();
            }

            for ( var key in initializer ) {
                instance[key] = initializer[key]; 
            }

            kernelGenerator && Object.keys( kernel_api ).forEach( function( kernelFunctionName ) {
                instance[kernelFunctionName] = kernelGenerator.call( instance, kernelFunctionName ); // TODO: ignore if undefined
            } );

            viewGenerator && Object.keys( view_api ).forEach( function( viewFunctionName ) {
                instance[viewFunctionName] = viewGenerator.call( instance, viewFunctionName ); // TODO: ignore if undefined
            } );
                
            return instance;
        },

        create: function( kernel, view, stages, state, parameters ) {

            this.logger.infoc( "create" );

            // Interpret create( kernel, stages, ... ) as create( kernel, undefined, stages, ... )

            if ( view && view.length !== undefined ) { // is an array?
                parameters = state;
                state = stages;
                stages = view;
                view = undefined;
            }

            // Append this driver's stages to the pipeline to be placed in front of this driver.

            if ( ! view ) {
                stages = Array.prototype.concat.apply( [], ( this.pipeline || [] ).map( function( stage ) {
                    return ( stages || [] ).concat( stage );
                } ) ).concat( stages || [] );
            } else {
                stages = ( stages || [] ).concat( this.pipeline || [] );
            }

            // Create the driver stage using its module as its prototype.

            var instance = Object.create( this );

            // Attach the reference to the stage to the right through the view API.

            viewize.call( instance, view, view_api );

            // Create the pipeline to the left and attach the reference to the stage to the left
            // through the kernel API.

            kernelize.call( instance,
                stages.length ?
                    stages.pop().create( kernel, instance, stages ) :
                    kernel,
                kernel_api );

            // Attach the shared state object.

            instance.state = state || {};

            // Call the driver's initialize().

            initialize.apply( instance, parameters );

            // Call viewize() on the driver.

            function viewize( view, view_api ) {
                Object.getPrototypeOf( this ) && viewize.call( Object.getPrototypeOf( this ), view, view_api ); // depth-first recursion through the prototypes
                this.hasOwnProperty( "viewize" ) && this.viewize.call( instance, view, view_api ); // viewize() from the bottom up
            }

            // Call kernelize() on the driver.

            function kernelize( kernel, kernel_api ) {
                Object.getPrototypeOf( this ) && kernelize.call( Object.getPrototypeOf( this ), kernel, kernel_api ); // depth-first recursion through the prototypes
                this.hasOwnProperty( "kernelize" ) && this.kernelize.call( instance, kernel, kernel_api ); // kernelize() from the bottom up
            }

            // Call initialize() on the driver.

            function initialize( /* parameters */ ) {
                Object.getPrototypeOf( this ) && initialize.apply( Object.getPrototypeOf( this ), arguments ); // depth-first recursion through the prototypes
                this.hasOwnProperty( "initialize" ) && this.initialize.apply( instance, arguments ); // initialize() from the bottom up
            }

            // Return the driver stage. For the actual driver, return the leftmost stage in the
            // pipeline.

            if ( ! view ) {
                while ( instance.kernel !== kernel ) {
                    instance = instance.kernel;
                }
            }

            return instance;
        },

        kernelize: function( kernel, kernel_api ) {
            this.kernel = kernel;
        },
        
    };

} );
