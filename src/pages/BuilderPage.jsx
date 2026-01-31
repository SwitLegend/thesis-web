import { BuilderComponent } from "@builder.io/react";
import { useLocation } from "react-router-dom";
import "../builder/builder"; // runs builder.init()

export default function BuilderPage() {
  const location = useLocation();

  return (
    <BuilderComponent
      model="page"
      options={{ urlPath: location.pathname }} // matches Builder page URL
    />
  );
}
