const gulp = require('gulp');
const nunjucks = require('gulp-nunjucks');

gulp.task('default', () =>
    gulp.watch('tpl/*.njk', ['precompile'])
);

gulp.task('precompile', () => {
    gulp.src('tpl/*.njk')
        .pipe(nunjucks.precompile())
        .pipe(gulp.dest('./tpl'))
})