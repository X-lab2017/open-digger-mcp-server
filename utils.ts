async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function fetchData(url: string): Promise<unknown> {
  const response = await fetch(url);
  const responseBody = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(`Error on fetching data: status ${response.status}, body: ${responseBody}`);
  }
  return responseBody;
}
