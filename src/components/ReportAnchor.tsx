/* global HTMLAnchorElement */
import { AnchorHTMLAttributes, useContext } from "react";
import { ReportEmbedContext } from "../contexts/ReportEmbedContext";

/** Keep report section navigation, but show external references as text in embeds. */
export default function ReportAnchor(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const embedded = useContext(ReportEmbedContext);
  if (embedded && props.href && !props.href.startsWith("#"))
    return <span className={props.className}>{props.children}</span>;
  return <a {...props} />;
}
