# frozen_string_literal: true

#
# Copyright (C) 2014 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

require "timeout"

describe CanvasSanitize do
  describe "#clean" do
    subject { Sanitize.clean(html_string, CanvasSanitize::SANITIZE) }

    context "when the HTML string contains anchor tags" do
      context "and the href uses the 'tel' protocol" do
        let(:html_string) { '<a href="tel:+14123815500">Call Number</a>' }

        it { is_expected.to eq html_string }
      end
    end
  end

  it "shouldnt strip lang attributes by default" do
    cleaned = Sanitize.clean("<p lang='es'>Hola</p>", CanvasSanitize::SANITIZE)
    expect(cleaned).to eq("<p lang=\"es\">Hola</p>")
  end

  it "doesnt strip dir attributes by default" do
    cleaned = Sanitize.clean("<p dir='rtl'>RightToLeft</p>", CanvasSanitize::SANITIZE)
    expect(cleaned).to eq("<p dir=\"rtl\">RightToLeft</p>")
  end

  it "doesnt strip data-* attributes by default" do
    cleaned = Sanitize.clean("<p data-item-id='1234'>Item1234</p>", CanvasSanitize::SANITIZE)
    expect(cleaned).to eq("<p data-item-id=\"1234\">Item1234</p>")
  end

  it "does strip the specific data-method attribute" do
    input_html = "<a data-method='post'>Data-Method Attr</a>"
    expected_html = "<a>Data-Method Attr</a>"
    cleaned = Sanitize.clean(input_html, CanvasSanitize::SANITIZE)
    expect(cleaned).to eq(expected_html)
  end

  it "does not strip track elements" do
    cleaned = Sanitize.clean("<track src=\"http://google.com\"></track>", CanvasSanitize::SANITIZE)
    expect(cleaned).to eq("<track src=\"http://google.com\">")
  end

  it "sanitizes javascript protocol in mathml" do
    cleaned = Sanitize.clean("<math href=\"javascript:alert(1)\">CLICKME</math>", CanvasSanitize::SANITIZE)
    expect(cleaned).to eq("<math>CLICKME</math>")
  end

  it "sanitizes javascript protocol in math altimg attribute" do
    cleaned = Sanitize.clean('<math altimg="javascript:alert(1)">CLICKME</math>', CanvasSanitize::SANITIZE)
    expect(cleaned).not_to match(/javascript/)
    expect(cleaned).to include("CLICKME")
  end

  it "allows legitimate https url in math altimg attribute" do
    cleaned = Sanitize.clean('<math altimg="https://example.com/alt.png">x</math>', CanvasSanitize::SANITIZE)
    expect(cleaned).to include('altimg="https://example.com/alt.png"')
  end

  it "allows abbr elements" do
    cleaned = Sanitize.clean("<abbr title=\"Internationalization\">I18N</abbr>", CanvasSanitize::SANITIZE)
    expect(cleaned).to eq("<abbr title=\"Internationalization\">I18N</abbr>")
  end

  it "sanitizes javascript protocol in data-url" do
    cleaned = Sanitize.clean("<a data-url=\"javascript:alert('bad')\">Link</a>", CanvasSanitize::SANITIZE)
    expect(cleaned).to eq("<a>Link</a>")
  end

  it "sanitizes javascript protocol in data-item-href" do
    cleaned = Sanitize.clean("<a data-item-href=\"javascript:alert('bad')\">Link</a>", CanvasSanitize::SANITIZE)
    expect(cleaned).to eq("<a>Link</a>")
  end

  it "sanitizes style attributes width invalid url protocols" do
    str = "<div style='width: 200px; background: url(httpx://www.google.com) no-repeat left center; height: 10px;'></div>"
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).not_to match(/background/)
    expect(res).not_to match(/google/)
    expect(res).to match(/width/)
    expect(res).to match(/height/)
  end

  it "handles some tricky urls" do
    str = "<div style=\"width: 200px; background:url('java\nscript:alert(1)'); height: 10px;\"></div>"
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).not_to match(/background/)
    expect(res).not_to match(/alert/)
    expect(res).not_to match(/height/)
    expect(res).to match(/width/)

    str = "<div style=\"width: 200px; background:url('javascript\n:alert(1)'); height: 10px;\"></div>"
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).not_to match(/background/)
    expect(res).not_to match(/alert/)
    expect(res).not_to match(/height/)
    expect(res).to match(/width/)

    str = "<div style=\"width: 200px; background:url('&#106;avascript:alert(5)'); height: 10px;\"></div>"
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).not_to match(/background/)
    expect(res).not_to match(/alert/)
    expect(res).to match(/height/)
    expect(res).to match(/width/)
  end

  it "sanitizes style attributes with invalid methods" do
    str = "<div style=\"width: 200px; background:expression(); height: 10px;\"></div>"
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).not_to match(/background/)
    expect(res).not_to match(/\(/)
    expect(res).to match(/height/)
    expect(res).to match(/width/)
  end

  it "allows negative values" do
    str = "<div style='margin: -18px;height: 10px;'></div>"
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to match(/margin/)
    expect(res).to match(/height/)
  end

  it "removes non-whitelisted css attributes" do
    str = "<div style='bacon: 5px; border-left-color: #fff;'></div>"
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to match(/border-left-color/)
    expect(res).not_to match(/bacon/)
  end

  it "allows valid css methods with valid css protocols" do
    str = %{<div style="width: 200px; background: url(http://www.google.com) no-repeat left center; height: 10px;"></div>}
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq str
  end

  it "allows font tags with valid attributes" do
    str = %(<font face="Comic Sans MS" color="blue" size="3" bacon="yes">hello</font>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq %(<font face="Comic Sans MS" color="blue" size="3">hello</font>)
  end

  it "allows valid MathML" do
    str = %(<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow></math>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq str
  end

  it "strips invalid attributes from MathML" do
    str = %(<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi foo="bar">a</mi><mo>+</mo><mi>b</mi></mrow></math>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).not_to match(/foo/)
  end

  describe "MathML Intent attributes for screen reader accessibility" do
    it "preserves the intent attribute on mrow" do
      str = %(<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow intent="power($base, $exp)"><mi>x</mi><mn>2</mn></mrow></math>)
      res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
      expect(res).to include('intent="power($base, $exp)"')
    end

    it "preserves the arg attribute on mi" do
      str = %(<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi arg="base">x</mi></mrow></math>)
      res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
      expect(res).to include('arg="base"')
    end

    it "preserves intent and arg together for accessible math expressions" do
      str = %(<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow intent="power($base, $exp)"><mi arg="base">x</mi><mn arg="exp">2</mn></mrow></math>)
      res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
      expect(res).to include('intent="power($base, $exp)"')
      expect(res).to include('arg="base"')
      expect(res).to include('arg="exp"')
    end
  end

  describe "MathML layout attributes" do
    it "preserves numalign on mfrac" do
      str = %(<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac numalign="left" denomalign="right"><mn>1</mn><mn>2</mn></mfrac></math>)
      res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
      expect(res).to include('numalign="left"')
      expect(res).to include('denomalign="right"')
    end

    describe "mspace spacing attributes" do
      it "preserves width, height, and depth on mspace" do
        str = %(<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mn>1</mn><mspace width="2em" height="1em" depth="0.5em"/><mn>2</mn></mrow></math>)
        res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
        expect(res).to include('width="2em"')
        expect(res).to include('height="1em"')
        expect(res).to include('depth="0.5em"')
      end

      it "preserves mspace with only width" do
        str = %(<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mn>1</mn><mspace width="1em"/><mn>2</mn></mrow></math>)
        res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
        expect(res).to include('width="1em"')
      end

      it "strips unknown attributes from mspace" do
        str = %(<math xmlns="http://www.w3.org/1998/Math/MathML"><mspace width="1em" notanattr="x"/></math>)
        res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
        expect(res).to include('width="1em"')
        expect(res).not_to include("notanattr")
      end
    end
  end

  it "removes and not escape contents of style tags" do
    str = %(<p><style>button { color: white !important; }</style>but not me</p>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq "<p>but not me</p>"
  end

  it "is not extremely slow with long, weird microsoft styles" do
    str = %(<span lang="EN" style="font-family: 'Times New Roman','serif'; color: #17375e; font-size: 12pt; mso-fareast-font-family: 'Times New Roman'; mso-themecolor: text2; mso-themeshade: 191; mso-style-textfill-fill-color: #17375E; mso-style-textfill-fill-themecolor: text2; mso-style-textfill-fill-alpha: 100.0%; mso-ansi-language: EN; mso-style-textfill-fill-colortransforms: lumm=75000"><p></p></span>)
    # the above string took over a minute to sanitize as of 8ae4ba8e
    Timeout.timeout(1) { Sanitize.clean(str, CanvasSanitize::SANITIZE) }
  end

  it "allows data sources for audio tags" do
    str = %(<audio controls="" src="data:audio/mp3;base64,aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1kUXc0dzlXZ1hjUQ=="></audio>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq str
  end

  it "allows data sources for video tags" do
    str = %(<video controls="" src="data:video/mp4;base64,aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1kUXc0dzlXZ1hjUQ=="></video>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq str
  end

  it "allows data sources for source tags" do
    str = %(<source type="audio/mp3" src="data:audio/mp3;base64,aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1kUXc0dzlXZ1hjUQ==">)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq str
  end

  it "allows data sources for track tags" do
    str = %(<track kind="subtitles" srclang="en" label="English" src="data:audio/mp3;base64,aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1kUXc0dzlXZ1hjUQ==">)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq str
  end

  it "allows clsid protocol for object#classid" do
    str = %(<object classid="clsid:1234"></object>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq str
  end

  it "does not allow javascript protocol for object#classid" do
    str = %(<object classid="javascript:alert(1)"></object>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq "<object></object>"
  end

  it "strips spaces from ids" do
    str = %(<div class="mini_month"><div class="day_wrapper" id="mini_day_2023_10_31_1"><div class="mini_calendar_day" id="mini_day_2023_10_31_1, id=[<img src=x onerror='alert(`${document.domain}:${document.cookie}`)' />]">Click me to trigger XSS</div></div></div>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq(%(<div class="mini_month"><div class="day_wrapper" id="mini_day_2023_10_31_1"><div class="mini_calendar_day" id="mini_day_2023_10_31_1,id=[<imgsrc=xonerror='alert(`${document.domain}:${document.cookie}`)'/>]">Click me to trigger XSS</div></div></div>))
  end

  it "strips tabs and long whitespace from ids" do
    str = %(<div id="my id    with      tabs    and  spaces"></div>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq %(<div id="myidwithtabsandspaces"></div>)
  end

  it "does not affect ids without whitespace" do
    str = %(<div id="my-id-5"></div>)
    res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
    expect(res).to eq str
  end

  # position: fixed and sticky escape the .user_content container and can overlay
  # Canvas UI — a clickjacking vector. position: absolute is safe because Canvas
  # wraps user content in `.user_content { position: relative }`, which constrains
  # absolute children. z-index is allowed because fixed/sticky are blocked, so
  # z-index cannot be used to overlay Canvas UI. clip is blocked outright.
  describe "overlay-capable CSS property blocking" do
    it "strips the clip CSS property" do
      res = Sanitize.clean(%(<div style="clip: rect(0,0,0,0)">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/\bclip\b/)
    end

    it "preserves z-index (safe: position:fixed/sticky are blocked)" do
      res = Sanitize.clean(%(<div style="z-index: 10">x</div>), CanvasSanitize::SANITIZE)
      expect(res).to match(/z-index/)
    end

    # fixed and sticky escape the container boundary — the actual clickjacking danger.
    it "strips position: fixed" do
      res = Sanitize.clean(%(<div style="position: fixed">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/position/)
    end

    it "strips position: sticky" do
      res = Sanitize.clean(%(<div style="position: sticky">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/position/)
    end

    it "strips position: fixed in compact (no-space) form" do
      res = Sanitize.clean(%(<div style="position:fixed;color:red">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/position/)
      expect(res).to match(/color/)
    end

    # relative and static stay within the .user_content boundary — safe to allow.
    it "preserves position: relative" do
      res = Sanitize.clean(%(<div style="position: relative">x</div>), CanvasSanitize::SANITIZE)
      expect(res).to match(/position/)
      expect(res).to match(/relative/)
    end

    it "preserves position: static" do
      res = Sanitize.clean(%(<div style="position: static">x</div>), CanvasSanitize::SANITIZE)
      expect(res).to match(/position/)
      expect(res).to match(/static/)
    end

    it "preserves position: absolute with offset properties" do
      res = Sanitize.clean(%(<div style="position: absolute; top: 0; left: 0">x</div>), CanvasSanitize::SANITIZE)
      expect(res).to match(/position/)
      expect(res).to match(/absolute/)
      expect(res).to match(/top/)
      expect(res).to match(/left/)
    end

    it "preserves responsive iframe embed wrapper (position:relative div + position:absolute iframe)" do
      html = <<~HTML
        <div style="position: relative; width: 100%; padding-top: 56.25%; overflow: hidden;">
          <iframe src="https://example.com/embed/abc123"
                  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
                  title="Example embed"
                  allowfullscreen="allowfullscreen"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  loading="lazy"></iframe>
        </div>
      HTML
      res = Sanitize.clean(html, CanvasSanitize::SANITIZE)
      expect(res).to match(/position:\s*relative/)
      expect(res).to match(/position:\s*absolute/)
      expect(res).to match(/top:\s*0/)
      expect(res).to match(/left:\s*0/)
      expect(res).to match(/padding-top:\s*56\.25%/)
    end

    it "strips position: -webkit-sticky (vendor-prefixed sticky)" do
      res = Sanitize.clean(%(<div style="position: -webkit-sticky; top: 0">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/position/)
    end

    it "strips position: FIXED (case-insensitive)" do
      res = Sanitize.clean(%(<div style="position: FIXED">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/position/)
    end

    it "strips position: fixed !important" do
      res = Sanitize.clean(%(<div style="position: fixed !important">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/position/)
    end

    # top/left/right/bottom are harmless without fixed/sticky; stripping position
    # is enough to neutralise the overlay without discarding the offset values.
    it "strips position: fixed but preserves top/left/right/bottom" do
      res = Sanitize.clean(
        %(<div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999">x</div>),
        CanvasSanitize::SANITIZE
      )
      expect(res).not_to match(/position/)
      expect(res).to match(/z-index/)
      expect(res).to match(/top/)
      expect(res).to match(/left/)
      expect(res).to match(/right/)
      expect(res).to match(/bottom/)
    end

    it "preserves safe CSS properties alongside stripped position: fixed" do
      res = Sanitize.clean(
        %(<p style="color: red; position: fixed; padding: 8px; text-align: center">x</p>),
        CanvasSanitize::SANITIZE
      )
      expect(res).to match(/color/)
      expect(res).to match(/padding/)
      expect(res).to match(/text-align/)
      expect(res).not_to match(/position/)
    end

    it "does not strip safe-only declarations" do
      str = %(<p style="color: red; padding: 8px; text-align: center">x</p>)
      res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
      expect(res).to match(/color/)
      expect(res).to match(/padding/)
      expect(res).to match(/text-align/)
    end

    # Bypass regression tests: the transformer uses Crass to decode these so
    # raw-regex approaches would be evaded.
    it "strips position: fixed when value uses CSS character escapes" do
      # \66ixed => CSS-decoded 'f' + 'ixed' = 'fixed'
      res = Sanitize.clean(%(<div style="position: \\66ixed">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/fixed/)
    end

    it "strips position when property name uses CSS character escapes" do
      # \\70osition => CSS-decoded 'p' + 'osition' = 'position'
      res = Sanitize.clean(%(<div style="\\70osition: fixed">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/fixed/)
    end

    it "strips position: fixed with a newline between colon and value" do
      res = Sanitize.clean(%(<div style="position:\nfixed">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/fixed/)
    end

    it "strips position: fixed when preceded by a CSS comment" do
      res = Sanitize.clean(%(<div style="color: red;/**/position: fixed">x</div>), CanvasSanitize::SANITIZE)
      expect(res).not_to match(/fixed/)
      expect(res).to match(/color/)
    end
  end

  describe "poster attribute protocol enforcement" do
    it "strips javascript: from video poster" do
      res = Sanitize.clean('<video poster="javascript:alert(1)"></video>', CanvasSanitize::SANITIZE)
      expect(res).not_to include("poster")
      expect(res).not_to include("javascript")
    end

    it "strips javascript: from audio poster" do
      res = Sanitize.clean('<audio poster="javascript:alert(1)"></audio>', CanvasSanitize::SANITIZE)
      expect(res).not_to include("poster")
      expect(res).not_to include("javascript")
    end

    it "preserves a valid https poster URL on video" do
      res = Sanitize.clean('<video poster="https://canvas.example.com/poster.jpg"></video>', CanvasSanitize::SANITIZE)
      expect(res).to include('poster="https://canvas.example.com/poster.jpg"')
    end
  end

  describe "longdesc attribute protocol enforcement" do
    it "strips javascript: from img longdesc" do
      res = Sanitize.clean('<img src="x.png" longdesc="javascript:alert(1)">', CanvasSanitize::SANITIZE)
      expect(res).not_to include("longdesc")
      expect(res).not_to include("javascript")
    end

    it "preserves a valid https longdesc URL" do
      res = Sanitize.clean('<img src="x.png" longdesc="https://example.com/desc">', CanvasSanitize::SANITIZE)
      expect(res).to include('longdesc="https://example.com/desc"')
    end
  end

  describe "srcset attribute protocol enforcement" do
    it "strips javascript: from source srcset" do
      res = Sanitize.clean('<source srcset="javascript:alert(1) 2x">', CanvasSanitize::SANITIZE)
      expect(res).not_to include("srcset")
      expect(res).not_to include("javascript")
    end

    it "removes bad protocol candidates while preserving allowed ones" do
      res = Sanitize.clean('<source srcset="javascript:evil.com/x.png 2x, /canvas/y.jpg 1x">', CanvasSanitize::SANITIZE)
      expect(res).to eq '<source srcset="/canvas/y.jpg 1x">'

      res = Sanitize.clean('<source srcset="https://canvas.com/x.png 2x, javascript:evil/y.jpg 1x">', CanvasSanitize::SANITIZE)
      expect(res).to eq '<source srcset="https://canvas.com/x.png 2x">'
    end

    it "strips the entire srcset attribute when all candidates are invalid" do
      res = Sanitize.clean('<source srcset="javascript:evil.com/x.png 2x, script:other.com/y.png 1x">', CanvasSanitize::SANITIZE)
      expect(res).not_to include("srcset")
    end

    it "preserves data: image srcset candidates" do
      # URL-encoded form avoids the comma-split limitation that affects base64 data URLs
      res = Sanitize.clean('<source srcset="data:image/svg+xml,%3Csvg%2F%3E 1x">', CanvasSanitize::SANITIZE)
      expect(res).to include("data:image/svg+xml")
    end

    it "preserves a valid https srcset candidate with density descriptor" do
      res = Sanitize.clean('<source srcset="https://example.com/img.png 2x">', CanvasSanitize::SANITIZE)
      expect(res).to include('srcset="https://example.com/img.png 2x"')
    end
  end

  Dir.glob(File.expand_path(File.join(__FILE__, "..", "..", "fixtures", "xss", "*.xss"))) do |filename|
    name = File.split(filename).last
    it "sanitizes xss attempts for #{name}" do
      File.open(filename) do |f|
        check = f.readline.strip
        str = f.read
        res = Sanitize.clean(str, CanvasSanitize::SANITIZE)
        expect(res.downcase).not_to match(Regexp.new(check.downcase))
      end
    end
  end
end
