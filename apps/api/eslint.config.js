import { configApp } from '@adonisjs/eslint-config'

export default configApp(
  { ignores: ['.adonisjs/**', 'build/**'] },
  {
    // app/domain is pure: no ORM, no database, no HTTP, no framework services.
    files: ['app/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // A regex: in gitignore-style `group` patterns a leading `#` is a comment.
              regex: '^(#(models|services|controllers|database|middleware)/|@adonisjs/|@vinejs/)',
              message: 'app/domain is pure: pass plain values in instead of importing I/O.',
            },
          ],
        },
      ],
    },
  }
)
