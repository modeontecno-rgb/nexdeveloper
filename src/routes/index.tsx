import {createFileRoute} from "@tanstack/react-router";
import {EstudioDesarrollo} from "@/components/nex/estudio-desarrollo";
export const Route=createFileRoute("/")({head:()=>({meta:[{title:"Desarrollar · NexDeveloper"}]}),component:EstudioDesarrollo});
