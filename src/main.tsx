import React, { lazy, Suspense, useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ResourceGate } from './components/ResourceAccess'
import { Home } from './pages/Home'
import './lib/posthog'
import './styles.css'
import './enhancements.css'
import './pricing.css'
import './card-price.css'
import './admin-quote-fix.css'
import './admin-assets.css'
import './commerce.css'
import './crm-refresh.css'
import './software-pricing.css'
import './legal.css'
import './decision-content.css'
import './distributor-landing.css'
import './project-forms.css'
import './gadgets-shell.css'
import './rishi-site.css'
import './resources.css'
import './site-motion.css'
import './product-pages-admin.css'
import './resource-auth.css'
import './admin-kanban-quote.css'
import './admin-resource-analytics.css'
import './quote-resource.css'
import './sales-resource.css'
import './inventory-resource.css'
import './admin-profile.css'

const Solutions = lazy(() => import('./pages/Solutions').then((module) => ({ default: module.Solutions })))
const SolutionDetail = lazy(() => import('./pages/SolutionDetail').then((module) => ({ default: module.SolutionDetail })))
const SuccessCases = lazy(() => import('./pages/SuccessCases').then((module) => ({ default: module.SuccessCases })))
const SuccessCaseDetail = lazy(() => import('./pages/SuccessCaseDetail').then((module) => ({ default: module.SuccessCaseDetail })))
const About = lazy(() => import('./pages/About').then((module) => ({ default: module.About })))
const Contact = lazy(() => import('./pages/Contact').then((module) => ({ default: module.Contact })))
const DistributorGuadalajara = lazy(() => import('./pages/DistributorGuadalajara').then((module) => ({ default: module.DistributorGuadalajara })))
const Privacy = lazy(() => import('./pages/Privacy').then((module) => ({ default: module.Privacy })))
const Terms = lazy(() => import('./pages/Terms').then((module) => ({ default: module.Terms })))
const ProjectIntakeForm = lazy(() => import('./pages/ProjectIntakeForm').then((module) => ({ default: module.ProjectIntakeForm })))
const Resources = lazy(() => import('./pages/Resources').then((module) => ({ default: module.Resources })))
const QuoteResource = lazy(() => import('./pages/QuoteResource').then(module => ({ default: module.QuoteResource })))
const SalesResource = lazy(() => import('./pages/SalesResource').then(module => ({ default: module.SalesResource })))
const InventoryResource = lazy(() => import('./pages/InventoryResource').then(module => ({ default: module.InventoryResource })))
const TscReportsResource = lazy(() => import('./pages/TscReportsResource').then(module => ({ default: module.TscReportsResource })))
const SpreadsheetSqliteTool = lazy(() => import('./pages/Resources').then((module) => ({ default: module.SpreadsheetSqliteTool })))
const CsvTextConverter = lazy(() => import('./pages/Resources').then((module) => ({ default: module.CsvTextConverter })))
const HowWeWork = lazy(() => import('./pages/HowWeWork').then((module) => ({ default: module.HowWeWork })))
const Questions = lazy(() => import('./pages/Questions').then((module) => ({ default: module.Questions })))
const ServiceLanding = lazy(() => import('./pages/ServiceLanding').then((module) => ({ default: module.ServiceLanding })))
const ProductLanding = lazy(() => import('./pages/ProductLanding').then((module) => ({ default: module.ProductLanding })))
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })))
const Admin = lazy(() => import('./pages/Admin').then((module) => ({ default: module.Admin })))

function AppReady() {
  useLayoutEffect(() => { document.documentElement.classList.remove('app-loading') }, [])
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="loading">Cargando…</div>}>
        <AppReady />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/como-funciona" element={<Navigate to="/como-trabajamos" replace />} />
            <Route path="/que-incluye" element={<Navigate to="/soluciones" replace />} />
            <Route path="/precio" element={<Navigate to="/contacto" replace />} />
            <Route path="/demo" element={<Navigate to="/soluciones" replace />} />
            <Route path="/agendar-demo" element={<Navigate to="/contacto" replace />} />
            <Route path="/como-trabajamos" element={<HowWeWork />} />
            <Route path="/preguntas" element={<Questions />} />
            <Route path="/recursos" element={<ResourceGate><Resources /></ResourceGate>} />
            <Route path="/recursos/crear-cotizacion" element={<ResourceGate resourceSlug="crear-cotizacion"><QuoteResource /></ResourceGate>} />
            <Route path="/recursos/control-ventas" element={<ResourceGate resourceSlug="control-ventas"><SalesResource /></ResourceGate>} />
            <Route path="/recursos/inventario-basico" element={<ResourceGate resourceSlug="inventario-basico"><InventoryResource /></ResourceGate>} />
            <Route path="/recursos/reportes-tsc" element={<ResourceGate resourceSlug="reportes-tsc"><TscReportsResource /></ResourceGate>} />
            <Route path="/recursos/excel-a-sqlite" element={<ResourceGate resourceSlug="excel-a-sqlite"><SpreadsheetSqliteTool /></ResourceGate>} />
            <Route path="/recursos/csv-formato-texto" element={<ResourceGate resourceSlug="csv-formato-texto"><CsvTextConverter /></ResourceGate>} />
            <Route path="/formularios/proyecto" element={<ProjectIntakeForm />} />
            <Route path="/distribuidoras-guadalajara" element={<DistributorGuadalajara />} />
            <Route path="/nodavexa-control" element={<ProductLanding />} />
            <Route path="/bodegalia" element={<ProductLanding />} />
            <Route path="/automatizacion-pesaje-etiquetado" element={<ProductLanding />} />
            <Route path="/soluciones" element={<Solutions />} />
            <Route path="/soluciones/:slug" element={<SolutionDetail />} />
            <Route path="/casos-de-exito" element={<SuccessCases />} />
            <Route path="/casos-de-exito/:slug" element={<SuccessCaseDetail />} />
            <Route path="/nosotros" element={<About />} />
            <Route path="/contacto" element={<Contact />} />
            <Route path="/privacidad" element={<Privacy />} />
            <Route path="/terminos" element={<Terms />} />
            <Route path="/:slug" element={<ServiceLanding />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
