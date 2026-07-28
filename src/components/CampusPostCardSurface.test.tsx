import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CampusPostCardSurface from "@/components/CampusPostCardSurface";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

describe("CampusPostCardSurface", () => {
  beforeEach(() => {
    navigation.push.mockReset();
  });

  it("opens the post from a non-interactive part of the card", () => {
    render(
      <CampusPostCardSurface postId="post with spaces" data-testid="card">
        <p>Gönderi içeriği</p>
      </CampusPostCardSurface>,
    );

    fireEvent.click(screen.getByText("Gönderi içeriği"));

    expect(navigation.push).toHaveBeenCalledWith(
      "/gonderi/post%20with%20spaces",
    );
  });

  it("does not hijack buttons inside the card", () => {
    const onLike = vi.fn();

    render(
      <CampusPostCardSurface postId="post-1">
        <button type="button" onClick={onLike}>
          Beğen
        </button>
      </CampusPostCardSurface>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Beğen" }));

    expect(onLike).toHaveBeenCalledOnce();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("leaves modified clicks to native browser behavior", () => {
    render(
      <CampusPostCardSurface postId="post-1" data-testid="card">
        Gönderi
      </CampusPostCardSurface>,
    );

    fireEvent.click(screen.getByTestId("card"), { ctrlKey: true });

    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("respects a consumer that prevents the card click", () => {
    render(
      <CampusPostCardSurface
        postId="post-1"
        data-testid="card"
        onClick={(event) => event.preventDefault()}
      >
        Gönderi
      </CampusPostCardSurface>,
    );

    fireEvent.click(screen.getByTestId("card"));

    expect(navigation.push).not.toHaveBeenCalled();
  });
});
