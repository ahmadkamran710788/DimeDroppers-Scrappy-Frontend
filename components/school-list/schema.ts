import * as yup from "yup";

export const csvScrapeSchema = yup.object({
  file: yup.mixed().required("Choose a CSV with a maxPrepsLink column"),
  sports: yup
    .array()
    .of(yup.string().required())
    .min(1, "Select at least one sport")
    .required("Select at least one sport"),
});
