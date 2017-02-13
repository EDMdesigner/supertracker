var gulp = require("gulp");
var browserify = require("browserify");
var source = require("vinyl-source-stream");
var jscs = require("gulp-jscs");
var jshint = require("gulp-jshint");
var stylish = require("gulp-jscs-stylish");
var jsonlint = require("gulp-jsonlint");
var buildBranch = require("gulp-build-branch");
var change = require("gulp-change");
var git = require("gulp-git");
var jasmine = require("gulp-jasmine");
var istanbul = require("gulp-istanbul");
var pckg = require("./package.json");

var jsFiles = [
	"./**/*.js",
	"!node_modules/**/*",
	"!coverage/**/*",
	"!./dist/**/*"
];

var jsonFiles = [
	".jshintrc",
	".jscsrc"
];

// JSON lint
// ==================================================
gulp.task("jsonlint", function() {
	return gulp.src(jsonFiles)
		.pipe(jsonlint())
		.pipe(jsonlint.failOnError());
});


// JS Hint
// ==================================================
gulp.task("jshint", function() {
	return gulp.src(jsFiles)
		.pipe(jshint(".jshintrc"))
		.pipe(jshint.reporter("jshint-stylish"))
		.pipe(jshint.reporter("fail"));
});


// JS CodeStyle
// ==================================================
gulp.task("jscs", function() {
	return gulp.src(jsFiles)
		.pipe(jscs({
			configPath: ".jscsrc",
			fix: true
		}))
		.pipe(stylish())
		.pipe(jscs.reporter("fail"));
});

gulp.task("stage", ["build:prod"], function() {
	buildBranch({ folder: "dist", branch: "gh-pages" });
	git.push("origin", ["gh-pages"], {}, function (err) {
		if (err) {
			console.log("Error occured during git push");
			throw err;
		}
	});
});

gulp.task("stage:example", function() {
	gulp.src("examples/index.html")
		.pipe(change(function (content) {
			return content.replace(/%%VERSION%%/g, pckg.version);
		}))
		.pipe(gulp.dest("dist/"));
});

gulp.task("js:dev", ["js:prod"]);

gulp.task("js:prod", createBrowserifyTask({
	entries: ["./public/javascripts/tracker.js"],
	outputFileName: "supertracker.js",
	destFolder: "./dist/" + pckg.version + "/"
}));



// Build:prod
// ==================================================
gulp.task("build:prod", function() {
	gulp.start("js:prod");

	gulp.src("./dist/" + pckg.version + "/supertracker.js", {base: "./dist/" + pckg.version})
		.pipe(gulp.dest("./dist/latest/"));

	gulp.src("./src/index.html", {base: "./src"})
		.pipe(gulp.dest("./dist/" + pckg.version + "/"));

	gulp.src("./src/index.html", {base: "./src"})
		.pipe(gulp.dest("./dist/latest/"));
});


// Build:dev
// ==================================================
gulp.task("build:dev", ["test"], function() {
	gulp.start("js:dev");
});

// Test coverage
// ==================================================
gulp.task("pre-test", function () {
	return gulp.src(["src/**/*.js"])
		// Covering files
		.pipe(istanbul())
		// Force `require` to return covered files
		.pipe(istanbul.hookRequire());
});

gulp.task("istanbul", ["pre-test"], function () {
	return gulp.src(["spec/**/*.js"])
		.pipe(jasmine())
		// Creating the reports after tests ran
		.pipe(istanbul.writeReports())
		// Enforce a coverage of at least 90%
		.pipe(istanbul.enforceThresholds({ thresholds: { global: 90 } }));
});

function createBrowserifyTask(config) {
	return function() {
		var bundleMethod = browserify;//global.isWatching ? watchify : browserify;

		var bundler = bundleMethod({
			// Specify the entry point of your app
			debug: true,
			entries: config.entries,
			standalone: "supertracker"
		});

		var bundle = function() {
			return bundler
				//.transform(partialify)
				// Enable source maps!
				.bundle()
				// Use vinyl-source-stream to make the
				// stream gulp compatible. Specifiy the
				// desired output filename here.
				.pipe(source(config.outputFileName))
				// Specify the output destination
				.pipe(gulp.dest(config.destFolder));
		};

		return bundle();
	};
}

gulp.task("jasmine", function() {
	return gulp.src("spec/**/*Spec.js")
		.pipe(jasmine({
			verbose: true
		}));
});

gulp.task("test", ["jsonlint", "jshint", "istanbul"]);