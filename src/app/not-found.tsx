import Link from "next/link";
import { FamilyHeader } from "@/components/FamilyHeader";

export default function NotFound() {
  return <main className="not-found-shell"><FamilyHeader skipTarget="not-found-content" /><section id="not-found-content" tabIndex={-1}><p className="eyebrow">404 / NOT FOUND</p><h1>This path is not part of LifePot.</h1><Link className="primary-button" href="/">Return to Configure</Link></section></main>;
}
