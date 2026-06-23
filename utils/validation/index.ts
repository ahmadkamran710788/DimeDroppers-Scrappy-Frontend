import * as yup from "yup";

export async function validateForm<T extends object>(
  schema: yup.ObjectSchema<Record<string, unknown>>,
  data: T
): Promise<Record<string, string>> {
  try {
    await schema.validate(data, { abortEarly: false });
    return {};
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      const errors: Record<string, string> = {};
      err.inner.forEach((e) => {
        if (e.path && !errors[e.path]) errors[e.path] = e.message;
      });
      return errors;
    }
    return {};
  }
}

export async function validateAndSetErrors<T extends object>(
  schema: yup.ObjectSchema<Record<string, unknown>>,
  data: T,
  setErrors: (errors: Record<string, string>) => void
): Promise<boolean> {
  const errors = await validateForm(schema, data);
  if (Object.keys(errors).length > 0) {
    setErrors(errors);
    return false;
  }
  return true;
}
