import { Typography } from "antd";
import { Link } from "react-router-dom";

interface SpeciesLinkProps {
  species: string;
  italic?: boolean;
}

function SpeciesLink({ species, italic = true }: SpeciesLinkProps) {
  return (
    <Link
      to={`/species/${encodeURIComponent(species)}`}
      style={{ color: "inherit", textDecoration: "none" }}
    >
      <Typography.Text
        italic={italic}
        style={{
          cursor: "pointer",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textDecorationColor: "rgba(0, 0, 0, 0.3)",
        }}
      >
        {species}
      </Typography.Text>
    </Link>
  );
}

export default SpeciesLink;
