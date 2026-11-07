import { test } from '@japa/runner'

test.group('Error messages locale', () => {
  test('errors follow Accept-Language when it names a supported locale', async ({ client }) => {
    const response = await client.get('/api/v1/nowhere').header('Accept-Language', 'es-MX,es;q=0.9')

    response.assertStatus(404)
    response.assertBody({ message: 'No encontrado', code: 'E_ROUTE_NOT_FOUND' })
    response.assertHeader('content-language', 'es')
  })

  test('errors fall back to english for unsupported languages', async ({ client }) => {
    const response = await client.get('/api/v1/nowhere').header('Accept-Language', 'th-TH')

    response.assertStatus(404)
    response.assertBody({ message: 'Not found', code: 'E_ROUTE_NOT_FOUND' })
  })

  test('errors fall back to english without Accept-Language', async ({ client }) => {
    const response = await client.get('/api/v1/nowhere')

    response.assertBody({ message: 'Not found', code: 'E_ROUTE_NOT_FOUND' })
  })

  test('requests that match no route are translated too', async ({ client }) => {
    const response = await client.post('/api/v1/nowhere').header('Accept-Language', 'es')

    response.assertStatus(404)
    response.assertBody({ message: 'No encontrado', code: 'E_ROUTE_NOT_FOUND' })
  })
})
