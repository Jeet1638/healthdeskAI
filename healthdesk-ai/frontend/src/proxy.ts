import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/conversations/:path*",
    "/appointments/:path*",
    "/patients/:path*",
    "/intake/:path*",
    "/settings/:path*",
  ],
};
