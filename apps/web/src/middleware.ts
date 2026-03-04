import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * URL redirect map: old standalone routes → new hub pages with tab param.
 * Keeps bookmarks & shared links working after the navigation refonte.
 */
const ROUTE_REDIRECTS: Record<string, string> = {
  '/banks': '/patrimoine?tab=banques',
  '/crypto': '/patrimoine?tab=crypto',
  '/stocks': '/patrimoine?tab=bourse',
  '/realestate': '/patrimoine?tab=immobilier',
  '/cashflow': '/gestion?tab=cashflow',
  '/budget': '/gestion?tab=budget',
  '/calendar': '/gestion?tab=calendrier',
  '/debts': '/gestion?tab=dettes',
  '/projects': '/objectifs?tab=projets',
  '/retirement': '/objectifs?tab=retraite',
  '/heritage': '/objectifs?tab=heritage',
  '/insights': '/intelligence?tab=analyses',
  '/fees': '/intelligence?tab=frais',
  '/fiscal': '/intelligence?tab=fiscal',
  '/autopilot': '/intelligence?tab=autopilot',
  '/alerts': '/intelligence?tab=alertes',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect old routes to new hub pages
  const redirect = ROUTE_REDIRECTS[pathname]
  if (redirect) {
    const url = request.nextUrl.clone()
    const parts = redirect.split('?')
    url.pathname = parts[0] ?? redirect
    if (parts[1]) {
      url.search = `?${parts[1]}`
    }
    return NextResponse.redirect(url, 308) // 308 = permanent redirect preserving method
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
