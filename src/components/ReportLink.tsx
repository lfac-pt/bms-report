import { useContext } from "react";
import { Link, LinkProps } from "react-router-dom";
import { ReportEmbedContext } from "../contexts/ReportEmbedContext";

export default function ReportLink(props: LinkProps) {
  const applicationUrl = useContext(ReportEmbedContext);
  if (applicationUrl) {
    if (typeof props.children === "string" && props.children.startsWith("Ver espécie")) return null;
    return <span className={props.className}>{props.children}</span>;
  }
  return <Link {...props} />;
}
