import { useContext } from "react";
import { Link, LinkProps } from "react-router-dom";
import { ReportEmbedContext } from "../contexts/ReportEmbedContext";

export default function ReportLink(props: LinkProps) {
  const applicationUrl = useContext(ReportEmbedContext);
  if (applicationUrl && typeof props.to === "string") {
    const { to, ...anchorProps } = props;
    return (
      <a
        {...anchorProps}
        href={`${applicationUrl.replace(/#.*$/, "")}#${to}`}
        target="_blank"
        rel="noopener noreferrer"
      />
    );
  }
  return <Link {...props} />;
}
